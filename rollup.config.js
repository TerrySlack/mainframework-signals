import typescript from "@rollup/plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import preserveDirectives from "rollup-plugin-preserve-directives";

export default [
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.mjs",
      format: "esm",
      sourcemap: true,
    },
    external: ["react"],
    // ADD THIS HOOK TO FAIL THE BUILD
    onwarn(warning, warn) {
      if (warning.code === "CIRCULAR_DEPENDENCY") {
        throw new Error(`Build failed! Circular dependency detected: ${warning.message}`);
      }
      warn(warning); // Let other warnings pass through normally
    },
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
    },
    external: ["react", "react/jsx-runtime"],
    onwarn(warning, warn) {
      if (warning.code === "CIRCULAR_DEPENDENCY") {
        throw new Error(`Build failed! Circular dependency detected: ${warning.message}`);
      }
      warn(warning);
    },
    plugins: [
      nodeResolve(),
      preserveDirectives(),
      typescript({
        tsconfig: "./tsconfig.json",
        sourceMap: true,
        declaration: false,
        outDir: "dist/react",
      }),
    ],
  },
];
