import { describe, it, expect } from "vitest";

import { transform } from "./src/transform";

const DEFAULT_DIRTY = "@mainframework/signals/dom/internal";

const run = (code: string) => transform(code, { markDomDirtyImport: DEFAULT_DIRTY }).code;

describe("dom-compiler transform", () => {
  it("rewrites assignment inside effect", () => {
    const input = `import { effect, createSignal } from "@mainframework/signals";
import { domSignal } from "@mainframework/signals/dom";

const count = createSignal("c", 0);
const dom = domSignal("x", null);
effect(() => {
  dom.textContent = String(count());
});
`;

    expect(run(input)).toBe(
      `import { effect, createSignal } from "@mainframework/signals";
import { domSignal } from "@mainframework/signals/dom";
import { markDomDirty } from "${DEFAULT_DIRTY}";

const count = createSignal("c", 0);
const dom = domSignal("x", null);
effect(() => {
  let _wrote_dom = false;
  try {
    const _v = String(count());
    const _el = dom.element;
    if (_el) {
      _el.textContent = _v;
      _wrote_dom = true;
    }
  } finally {
    if (_wrote_dom) markDomDirty(dom);
  }
});
`,
    );
  });

  it("rewrites when effect is imported as fx", () => {
    const input = `import { effect as fx, createSignal } from "@mainframework/signals";
import { domSignal } from "@mainframework/signals/dom";

const count = createSignal("c", 0);
const dom = domSignal("x", null);
fx(() => {
  dom.textContent = String(count());
});
`;

    expect(run(input)).toBe(
      `import { effect as fx, createSignal } from "@mainframework/signals";
import { domSignal } from "@mainframework/signals/dom";
import { markDomDirty } from "${DEFAULT_DIRTY}";

const count = createSignal("c", 0);
const dom = domSignal("x", null);
fx(() => {
  let _wrote_dom = false;
  try {
    const _v = String(count());
    const _el = dom.element;
    if (_el) {
      _el.textContent = _v;
      _wrote_dom = true;
    }
  } finally {
    if (_wrote_dom) markDomDirty(dom);
  }
});
`,
    );
  });

  it("leaves write outside effect unchanged", () => {
    const input = `import { domSignal } from "@mainframework/signals/dom";

const dom = domSignal("x", null);
dom.textContent = "hi";
`;

    expect(run(input)).toBe(input);
  });

  it("leaves node.textContent unchanged when node is not an inferred binding", () => {
    const input = `import { effect } from "@mainframework/signals";

const node = document.createElement("div");
effect(() => {
  node.textContent = "hi";
});
`;

    expect(run(input)).toBe(input);
  });

  it("does not wrap the callback in a nested effect", () => {
    const input = `import { effect, createSignal } from "@mainframework/signals";
import { domSignal } from "@mainframework/signals/dom";

const count = createSignal("c", 0);
const dom = domSignal("x", null);
effect(() => {
  dom.textContent = String(count());
});
`;

    const out = run(input);
    expect(out).not.toMatch(/effect\s*\(\s*\(\)\s*=>\s*\{[\s\S]*effect\s*\(/);
    expect(out).toContain("effect(() => {");
  });

  it("evaluates RHS before element null check", () => {
    const input = `import { effect, createSignal } from "@mainframework/signals";
import { domSignal } from "@mainframework/signals/dom";

const count = createSignal("c", 0);
const dom = domSignal("x", null);
effect(() => {
  dom.textContent = String(count());
});
`;

    const out = run(input);
    const tryBlock = out.match(/try \{([\s\S]*?)\} finally/)?.[1] ?? "";
    const vPos = tryBlock.indexOf("const _v");
    const elPos = tryBlock.indexOf("const _el");
    expect(vPos).toBeGreaterThanOrEqual(0);
    expect(elPos).toBeGreaterThan(vPos);
  });

  it("uses finally and a per-binding write flag", () => {
    const input = `import { effect, createSignal } from "@mainframework/signals";
import { domSignal } from "@mainframework/signals/dom";

const count = createSignal("c", 0);
const dom = domSignal("x", null);
effect(() => {
  dom.textContent = String(count());
});
`;

    const out = run(input);
    expect(out).toContain("let _wrote_dom = false");
    expect(out).toContain("} finally {");
    expect(out).toContain("if (_wrote_dom) markDomDirty(dom)");
  });

  it("rewrites two dom bindings in one effect", () => {
    const input = `import { effect, createSignal } from "@mainframework/signals";
import { domSignal } from "@mainframework/signals/dom";

const a = createSignal("a", 0);
const b = createSignal("b", 0);
const domA = domSignal("a", null);
const domB = domSignal("b", null);
effect(() => {
  domA.textContent = String(a());
  domB.textContent = String(b());
});
`;

    expect(run(input)).toBe(
      `import { effect, createSignal } from "@mainframework/signals";
import { domSignal } from "@mainframework/signals/dom";
import { markDomDirty } from "${DEFAULT_DIRTY}";

const a = createSignal("a", 0);
const b = createSignal("b", 0);
const domA = domSignal("a", null);
const domB = domSignal("b", null);
effect(() => {
  let _wrote_domA = false;
  let _wrote_domB = false;
  try {
    const _v0 = String(a());
    const _el0 = domA.element;
    if (_el0) {
      _el0.textContent = _v0;
      _wrote_domA = true;
    }
    const _v1 = String(b());
    const _el1 = domB.element;
    if (_el1) {
      _el1.textContent = _v1;
      _wrote_domB = true;
    }
  } finally {
    if (_wrote_domA) markDomDirty(domA);
    if (_wrote_domB) markDomDirty(domB);
  }
});
`,
    );
  });

  it("calls markDomDirty after early return when a write occurred", () => {
    const input = `import { effect, createSignal } from "@mainframework/signals";
import { domSignal } from "@mainframework/signals/dom";

const flag = createSignal("f", true);
const dom = domSignal("x", null);
effect(() => {
  dom.textContent = "x";
  if (flag()) return;
});
`;

    expect(run(input)).toBe(
      `import { effect, createSignal } from "@mainframework/signals";
import { domSignal } from "@mainframework/signals/dom";
import { markDomDirty } from "${DEFAULT_DIRTY}";

const flag = createSignal("f", true);
const dom = domSignal("x", null);
effect(() => {
  let _wrote_dom = false;
  try {
    const _v = "x";
    const _el = dom.element;
    if (_el) {
      _el.textContent = _v;
      _wrote_dom = true;
    }
    if (flag()) return;
  } finally {
    if (_wrote_dom) markDomDirty(dom);
  }
});
`,
    );
  });

  it("merges into an existing markDomDirty import", () => {
    const input = `import { markDomDirty } from "${DEFAULT_DIRTY}";
import { effect, createSignal } from "@mainframework/signals";
import { domSignal } from "@mainframework/signals/dom";

const count = createSignal("c", 0);
const dom = domSignal("x", null);
effect(() => {
  dom.textContent = String(count());
});
`;

    const out = run(input);
    expect(out).not.toMatch(/import \{ markDomDirty \}[^\n]+\nimport \{ markDomDirty \}/);
    expect(out).toContain(`import { markDomDirty } from "${DEFAULT_DIRTY}"`);
    expect(out).toContain("if (_wrote_dom) markDomDirty(dom)");
  });

  it('keeps "use client" as the first statement', () => {
    const input = `"use client";
import { effect, createSignal } from "@mainframework/signals";
import { domSignal } from "@mainframework/signals/dom";

const count = createSignal("c", 0);
const dom = domSignal("x", null);
effect(() => {
  dom.textContent = String(count());
});
`;

    const out = run(input);
    expect(out.startsWith('"use client";')).toBe(true);
    const afterDirective = out.slice('"use client";'.length).trimStart();
    expect(afterDirective.startsWith(`import { effect`)).toBe(true);
    expect(out).toContain("markDomDirty");
  });
});
