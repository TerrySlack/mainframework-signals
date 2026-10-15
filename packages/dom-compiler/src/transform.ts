import generate from "@babel/generator";
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";

import type { TransformOptions, TransformResult } from "./types";

const IDL_PROPS = new Set([
  "textContent",
  "innerHTML",
  "className",
  "id",
  "hidden",
  "value",
  "checked",
  "disabled",
  "src",
  "href",
  "alt",
  "title",
  "placeholder",
  "type",
  "name",
  "htmlFor",
  "tabIndex",
]);

const DOM_FACTORY_NAMES = new Set(["domSignal", "useDomSignal"]);

const defaultOptions = (options?: TransformOptions) => ({
  markDomDirtyImport: options?.markDomDirtyImport ?? "@mainframework/signals/dom/internal",
  effectImportSources: options?.effectImportSources ?? ["@mainframework/signals"],
  bindings: options?.bindings ?? [],
  filename: options?.filename,
});

const isDomFactoryCall = (node: t.Expression | null | undefined): boolean => {
  if (!node || !t.isCallExpression(node)) {
    return false;
  }

  return t.isIdentifier(node.callee) && DOM_FACTORY_NAMES.has(node.callee.name);
};

const parseProperty = (
  member: t.MemberExpression,
): { kind: "idl"; name: string } | { kind: "attr"; name: string } | null => {
  if (t.isIdentifier(member.property) && !member.computed) {
    if (IDL_PROPS.has(member.property.name)) {
      return { kind: "idl", name: member.property.name };
    }

    return null;
  }

  if (member.computed && t.isStringLiteral(member.property)) {
    const key = member.property.value;

    if (IDL_PROPS.has(key)) {
      return { kind: "idl", name: key };
    }

    if (key.startsWith("attr:")) {
      const attrName = key.slice("attr:".length);

      if (attrName.length === 0) {
        return null;
      }

      return { kind: "attr", name: attrName };
    }
  }

  return null;
};

const writeFlagName = (binding: string) => `_wrote_${binding}`;

const tempNames = (index: number, total: number): { v: string; el: string } => {
  if (total === 1) {
    return { v: "_v", el: "_el" };
  }

  return { v: `_v${index}`, el: `_el${index}` };
};

const buildWriteStatements = (
  binding: string,
  prop: { kind: "idl"; name: string } | { kind: "attr"; name: string },
  rhs: t.Expression,
  valueId: t.Identifier,
  elId: t.Identifier,
  flagId: t.Identifier,
): t.Statement[] => {
  const domRef = t.identifier(binding);
  const elMember = t.memberExpression(domRef, t.identifier("element"));

  const prelude: t.Statement[] = [
    t.variableDeclaration("const", [t.variableDeclarator(valueId, rhs)]),
    t.variableDeclaration("const", [t.variableDeclarator(elId, elMember)]),
  ];

  const writeBody: t.Statement[] = [];

  if (prop.kind === "idl") {
    writeBody.push(
      t.expressionStatement(t.assignmentExpression("=", t.memberExpression(elId, t.identifier(prop.name)), valueId)),
    );
  } else {
    writeBody.push(
      t.ifStatement(
        t.logicalExpression(
          "||",
          t.binaryExpression("===", valueId, t.nullLiteral()),
          t.binaryExpression("===", valueId, t.identifier("undefined")),
        ),
        t.expressionStatement(
          t.callExpression(t.memberExpression(elId, t.identifier("removeAttribute")), [t.stringLiteral(prop.name)]),
        ),
        t.expressionStatement(
          t.callExpression(t.memberExpression(elId, t.identifier("setAttribute")), [
            t.stringLiteral(prop.name),
            valueId,
          ]),
        ),
      ),
    );
  }

  writeBody.push(t.expressionStatement(t.assignmentExpression("=", flagId, t.booleanLiteral(true))));

  return [...prelude, t.ifStatement(t.identifier(elId.name), t.blockStatement(writeBody))];
};

const rewriteAssignment = (
  assignment: t.AssignmentExpression,
  inferred: Set<string>,
  valueIndex: number,
  writeTotal: number,
): { binding: string; statements: t.Statement[] } | null => {
  if (assignment.operator !== "=") {
    return null;
  }

  if (!t.isMemberExpression(assignment.left)) {
    return null;
  }

  if (!t.isIdentifier(assignment.left.object)) {
    return null;
  }

  const binding = assignment.left.object.name;

  if (!inferred.has(binding)) {
    return null;
  }

  const prop = parseProperty(assignment.left);

  if (!prop) {
    return null;
  }

  const names = tempNames(valueIndex, writeTotal);
  const valueId = t.identifier(names.v);
  const elId = t.identifier(names.el);

  const flagId = t.identifier(writeFlagName(binding));

  return {
    binding,
    statements: buildWriteStatements(binding, prop, assignment.right, valueId, elId, flagId),
  };
};

const countRewritableInStatements = (statements: t.Statement[], inferred: Set<string>): number => {
  let count = 0;

  for (const stmt of statements) {
    if (t.isExpressionStatement(stmt) && t.isAssignmentExpression(stmt.expression)) {
      if (rewriteAssignment(stmt.expression, inferred, 0, 1)) {
        count += 1;
      }
    }
  }

  return count;
};

const wrapCallbackBody = (fn: t.ArrowFunctionExpression | t.FunctionExpression, inferred: Set<string>): boolean => {
  const bindingsWritten = new Set<string>();

  const transformStatements = (statements: t.Statement[], writeTotal: number): t.Statement[] => {
    const out: t.Statement[] = [];
    let valueIndex = 0;

    for (const stmt of statements) {
      if (t.isExpressionStatement(stmt) && t.isAssignmentExpression(stmt.expression)) {
        const rewritten = rewriteAssignment(stmt.expression, inferred, valueIndex, writeTotal);

        if (rewritten) {
          bindingsWritten.add(rewritten.binding);
          valueIndex += 1;
          out.push(...rewritten.statements);
          continue;
        }
      }

      out.push(stmt);
    }

    return out;
  };

  if (t.isAssignmentExpression(fn.body)) {
    const rewritten = rewriteAssignment(fn.body, inferred, 0, 1);

    if (!rewritten) {
      return false;
    }

    bindingsWritten.add(rewritten.binding);
    const flagName = writeFlagName(rewritten.binding);
    const flagId = t.identifier(flagName);

    fn.body = t.blockStatement([
      t.variableDeclaration("let", [t.variableDeclarator(flagId, t.booleanLiteral(false))]),
      t.tryStatement(
        t.blockStatement(rewritten.statements),
        null,
        t.blockStatement([
          t.ifStatement(
            flagId,
            t.expressionStatement(t.callExpression(t.identifier("markDomDirty"), [t.identifier(rewritten.binding)])),
          ),
        ]),
      ),
    ]);

    if (t.isArrowFunctionExpression(fn)) {
      fn.expression = false;
    }

    return true;
  }

  if (!t.isBlockStatement(fn.body)) {
    return false;
  }

  const writeTotal = countRewritableInStatements(fn.body.body, inferred);

  if (writeTotal === 0) {
    return false;
  }

  bindingsWritten.clear();
  const newBody = transformStatements(fn.body.body, writeTotal);

  if (bindingsWritten.size === 0) {
    return false;
  }

  const flagDecls = [...bindingsWritten].map((name) =>
    t.variableDeclaration("let", [t.variableDeclarator(t.identifier(writeFlagName(name)), t.booleanLiteral(false))]),
  );

  const finallyStmts = [...bindingsWritten].map((name) =>
    t.ifStatement(
      t.identifier(writeFlagName(name)),
      t.expressionStatement(t.callExpression(t.identifier("markDomDirty"), [t.identifier(name)])),
    ),
  );

  fn.body = t.blockStatement([
    ...flagDecls,
    t.tryStatement(t.blockStatement(newBody), null, t.blockStatement(finallyStmts)),
  ]);

  return true;
};

const collectInferredBindings = (program: t.File, extra: string[]): Set<string> => {
  const inferred = new Set<string>(extra);

  traverse(program, {
    VariableDeclarator(path) {
      if (!t.isIdentifier(path.node.id) || !path.node.init) {
        return;
      }

      if (!isDomFactoryCall(path.node.init)) {
        return;
      }

      inferred.add(path.node.id.name);
    },
  });

  return inferred;
};

const collectEffectLocals = (program: t.File, sources: string[]): Set<string> => {
  const locals = new Set<string>();

  traverse(program, {
    ImportDeclaration(path) {
      const source = path.node.source.value;

      if (!sources.includes(source)) {
        return;
      }

      for (const spec of path.node.specifiers) {
        if (!t.isImportSpecifier(spec)) {
          continue;
        }

        if (spec.importKind === "type") {
          continue;
        }

        if (t.isIdentifier(spec.imported) && spec.imported.name === "effect") {
          locals.add(spec.local.name);
        }
      }
    },
  });

  return locals;
};

const ensureMarkDomDirtyImport = (program: t.File, importSource: string): void => {
  let existing: t.ImportDeclaration | null = null;

  for (const stmt of program.program.body) {
    if (t.isImportDeclaration(stmt) && stmt.source.value === importSource) {
      existing = stmt;
      break;
    }
  }

  if (existing) {
    const has = existing.specifiers.some(
      (spec) => t.isImportSpecifier(spec) && t.isIdentifier(spec.imported) && spec.imported.name === "markDomDirty",
    );

    if (!has) {
      existing.specifiers.push(t.importSpecifier(t.identifier("markDomDirty"), t.identifier("markDomDirty")));
    }

    return;
  }

  const importDecl = t.importDeclaration(
    [t.importSpecifier(t.identifier("markDomDirty"), t.identifier("markDomDirty"))],
    t.stringLiteral(importSource),
  );

  let insertAt = 0;

  while (insertAt < program.program.body.length) {
    const stmt = program.program.body[insertAt];

    if (t.isExpressionStatement(stmt) && "directive" in stmt && stmt.directive) {
      insertAt += 1;
      continue;
    }

    break;
  }

  while (insertAt < program.program.body.length && t.isImportDeclaration(program.program.body[insertAt])) {
    insertAt += 1;
  }

  program.program.body.splice(insertAt, 0, importDecl);
};

export const transform = (code: string, options?: TransformOptions): TransformResult => {
  const resolved = defaultOptions(options);

  const ast = parse(code, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
    sourceFilename: resolved.filename,
  });

  const inferred = collectInferredBindings(ast, resolved.bindings);
  const effectLocals = collectEffectLocals(ast, resolved.effectImportSources);

  let changed = false;

  traverse(ast, {
    CallExpression(path) {
      if (!t.isIdentifier(path.node.callee) || !effectLocals.has(path.node.callee.name)) {
        return;
      }

      if (path.node.arguments.length !== 1) {
        return;
      }

      const arg = path.node.arguments[0];

      if (!t.isArrowFunctionExpression(arg) && !t.isFunctionExpression(arg)) {
        return;
      }

      if (wrapCallbackBody(arg, inferred)) {
        changed = true;
      }
    },
  });

  if (!changed) {
    return { code };
  }

  ensureMarkDomDirtyImport(ast, resolved.markDomDirtyImport);

  const trailingNewline = code.endsWith("\n");

  const output = generate(
    ast,
    {
      retainLines: false,
      compact: false,
      jsescOption: { minimal: true },
    },
    code,
  );

  let outCode = trailingNewline && !output.code.endsWith("\n") ? `${output.code}\n` : output.code;

  if (/\n\n(?:const |let |var |"|'use )/m.test(code)) {
    outCode = outCode.replace(/(import \{ markDomDirty \}[^\n]+\n)(?!\n)/, "$1\n");
  }

  if (resolved.filename) {
    return {
      code: outCode,
      map: output.map ?? undefined,
    };
  }

  return { code: outCode };
};
