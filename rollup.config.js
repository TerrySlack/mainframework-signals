import typescript from "@rollup/plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";

const STATEFUL_SUFFIXES = [
  "shared/core/reactive.ts",
  "shared/core/batch.ts",
  "shared/core/resource-timers.ts",
  "shared/store/signal-store.ts",
  "shared/store/store-cleanup.ts",
  "shared/store/store-janitor.ts",
  "shared/store/purge-registry.ts",
];

const normalizeId = (id) => id.replace(/\\/g, "/");

const isStatefulModule = (id) => {
  const norm = normalizeId(id);
  return STATEFUL_SUFFIXES.some((suffix) => norm.endsWith(suffix));
};

const statefulMjsPath = (id) => {
  const norm = normalizeId(id);
  const suffix = STATEFUL_SUFFIXES.find((entry) => norm.endsWith(entry));
  if (!suffix) {
    throw new Error(`Not a stateful module: ${id}`);
  }
  return `./${suffix.replace(/\.ts$/, ".mjs")}`;
};

const circularOnwarn = (warning, warn) => {
  if (warning.code === "CIRCULAR_DEPENDENCY") {
    throw new Error(`Build failed! Circular dependency detected: ${warning.message}`);
  }
  warn(warning);
};

const reactOnwarn = (warning, warn) => {
  if (warning.code === "CIRCULAR_DEPENDENCY") {
    throw new Error(`Build failed! Circular dependency detected: ${warning.message}`);
  }
  if (warning.code === "MODULE_LEVEL_DIRECTIVE") {
    throw new Error(`Build failed! Module level directive: ${warning.message}`);
  }
  warn(warning);
};

const sharedStatefulInputs = {
  "shared/core/reactive": "src/shared/core/reactive.ts",
  "shared/core/batch": "src/shared/core/batch.ts",
  "shared/core/resource-timers": "src/shared/core/resource-timers.ts",
  "shared/store/signal-store": "src/shared/store/signal-store.ts",
  "shared/store/store-cleanup": "src/shared/store/store-cleanup.ts",
  "shared/store/store-janitor": "src/shared/store/store-janitor.ts",
  "shared/store/purge-registry": "src/shared/store/purge-registry.ts",
};

const mainExternal = (id) => id === "react" || isStatefulModule(id);

const reactExternal = (id) => id === "react" || id === "react/jsx-runtime" || isStatefulModule(id);

const domCoreExternal = (id) => {
  const norm = normalizeId(id);
  if (isStatefulModule(id)) {
    return true;
  }
  return norm.endsWith("src/dom/core.ts") || norm.endsWith("/dom/core.ts");
};

const isDomStoreModule = (id) => {
  const norm = normalizeId(id);
  return norm.endsWith("src/dom/dom-store.ts") || norm.endsWith("/dom/dom-store.ts");
};

const isGetOrCreateDomSignalModule = (id) => {
  const norm = normalizeId(id);
  return norm.endsWith("src/dom/get-or-create-dom-signal.ts") || norm.endsWith("/dom/get-or-create-dom-signal.ts");
};

const domIndexExternal = (id) => {
  const norm = normalizeId(id);
  if (isStatefulModule(id)) {
    return true;
  }
  return (
    norm.endsWith("src/dom/core.ts") ||
    norm.endsWith("/dom/core.ts") ||
    isDomStoreModule(id) ||
    isGetOrCreateDomSignalModule(id)
  );
};

const domReactExternal = (id) => {
  const norm = normalizeId(id);
  if (id === "react" || id === "react/jsx-runtime" || isStatefulModule(id)) {
    return true;
  }
  return (
    norm.endsWith("src/dom/core.ts") ||
    norm.endsWith("/dom/core.ts") ||
    isDomStoreModule(id) ||
    isGetOrCreateDomSignalModule(id)
  );
};

const domInternalExternal = domCoreExternal;

const getOrCreateDomSignalBundleExternal = (id) => {
  const norm = normalizeId(id);
  if (isStatefulModule(id)) {
    return true;
  }
  return norm.endsWith("src/dom/core.ts") || norm.endsWith("/dom/core.ts") || isDomStoreModule(id);
};

const sharedPathsFromDom = (id) => {
  if (id === "react" || id === "react/jsx-runtime") {
    return id;
  }
  if (isStatefulModule(id)) {
    return `../${statefulMjsPath(id).slice(2)}`;
  }
  const norm = normalizeId(id);
  if (norm.endsWith("src/dom/core.ts") || norm.endsWith("/dom/core.ts")) {
    return "./core.mjs";
  }
  if (isDomStoreModule(id)) {
    return "./dom-store.mjs";
  }
  if (isGetOrCreateDomSignalModule(id)) {
    return "./get-or-create-dom-signal.mjs";
  }
  throw new Error(`Unexpected dom external: ${id}`);
};

export default [
  {
    input: sharedStatefulInputs,
    output: {
      dir: "dist",
      format: "esm",
      preserveModules: true,
      preserveModulesRoot: "src",
      entryFileNames: "[name].mjs",
      sourcemap: true,
    },
    external: ["@mainframework/timer"],
    onwarn: circularOnwarn,
    plugins: [nodeResolve(), typescript({ tsconfig: "./tsconfig.json", sourceMap: true, declaration: false })],
  },
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.mjs",
      format: "esm",
      sourcemap: true,
      paths: (id) => statefulMjsPath(id),
    },
    external: mainExternal,
    makeAbsoluteExternalsRelative: false,
    onwarn: circularOnwarn,
    plugins: [
      nodeResolve(),
      typescript({ tsconfig: "./tsconfig.json", sourceMap: true, declaration: false }),
      terser(),
    ],
  },
  {
    input: "src/react.ts",
    output: {
      dir: "dist/react",
      format: "esm",
      preserveModules: true,
      preserveModulesRoot: "src",
      sourcemap: true,
      paths: (id) => {
        if (isStatefulModule(id)) {
          return `../../../${statefulMjsPath(id).slice(2)}`;
        }
        return id;
      },
    },
    external: reactExternal,
    makeAbsoluteExternalsRelative: false,
    onwarn: reactOnwarn,
    plugins: [
      nodeResolve(),
      typescript({
        tsconfig: "./tsconfig.json",
        sourceMap: true,
        declaration: false,
        outDir: "dist/react",
      }),
    ],
  },
  {
    input: "src/dom/index.ts",
    output: {
      file: "dist/dom/index.mjs",
      format: "esm",
      sourcemap: true,
      paths: sharedPathsFromDom,
    },
    external: domIndexExternal,
    makeAbsoluteExternalsRelative: false,
    onwarn: circularOnwarn,
    plugins: [
      nodeResolve(),
      typescript({ tsconfig: "./tsconfig.json", sourceMap: true, declaration: false }),
      terser(),
    ],
  },
  {
    input: "src/dom/dom-store.ts",
    output: {
      file: "dist/dom/dom-store.mjs",
      format: "esm",
      sourcemap: true,
      paths: (id) => {
        if (isStatefulModule(id)) {
          return `../${statefulMjsPath(id).slice(2)}`;
        }
        throw new Error(`Unexpected dom-store external: ${id}`);
      },
    },
    external: (id) => isStatefulModule(id),
    makeAbsoluteExternalsRelative: false,
    onwarn: circularOnwarn,
    plugins: [nodeResolve(), typescript({ tsconfig: "./tsconfig.json", sourceMap: true, declaration: false })],
  },
  {
    input: "src/dom/get-or-create-dom-signal.ts",
    output: {
      file: "dist/dom/get-or-create-dom-signal.mjs",
      format: "esm",
      sourcemap: true,
      paths: sharedPathsFromDom,
    },
    external: getOrCreateDomSignalBundleExternal,
    makeAbsoluteExternalsRelative: false,
    onwarn: circularOnwarn,
    plugins: [nodeResolve(), typescript({ tsconfig: "./tsconfig.json", sourceMap: true, declaration: false })],
  },
  {
    input: "src/dom/core.ts",
    output: {
      file: "dist/dom/core.mjs",
      format: "esm",
      sourcemap: true,
      paths: (id) => {
        if (isStatefulModule(id)) {
          return `../${statefulMjsPath(id).slice(2)}`;
        }
        throw new Error(`Unexpected dom core external: ${id}`);
      },
    },
    external: (id) => isStatefulModule(id),
    makeAbsoluteExternalsRelative: false,
    onwarn: circularOnwarn,
    plugins: [
      nodeResolve(),
      typescript({ tsconfig: "./tsconfig.json", sourceMap: true, declaration: false }),
      terser(),
    ],
  },
  {
    input: "src/dom/react.ts",
    output: {
      file: "dist/dom/react.mjs",
      format: "esm",
      sourcemap: true,
      paths: sharedPathsFromDom,
    },
    external: domReactExternal,
    makeAbsoluteExternalsRelative: false,
    onwarn: reactOnwarn,
    plugins: [nodeResolve(), typescript({ tsconfig: "./tsconfig.json", sourceMap: true, declaration: false })],
  },
  {
    input: "src/dom/internal.ts",
    output: {
      file: "dist/dom/internal.mjs",
      format: "esm",
      sourcemap: true,
      paths: sharedPathsFromDom,
    },
    external: domInternalExternal,
    makeAbsoluteExternalsRelative: false,
    onwarn: circularOnwarn,
    plugins: [nodeResolve(), typescript({ tsconfig: "./tsconfig.json", sourceMap: true, declaration: false })],
  },
];
