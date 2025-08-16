import typescript from "@rollup/plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { terser } from "rollup-plugin-terser";
import dts from "rollup-plugin-dts";

export default [
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.mjs",
      format: "esm",
      sourcemap: true,
    },
    external: ["react"], // list peer dependencies here
    plugins: [
      nodeResolve(),
      typescript({ tsconfig: "./tsconfig.json", sourceMap: true, declaration: false }),
      terser(),
    ],
  },
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.d.ts",
      format: "esm",
    },
    plugins: [dts()],
  },
];
