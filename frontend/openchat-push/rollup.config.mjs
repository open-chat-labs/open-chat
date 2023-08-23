import commonjs from "@rollup/plugin-commonjs";
import inject from "@rollup/plugin-inject";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import del from "rollup-plugin-delete";

export default {
    input: `./src/push_sw.ts`,
    output: {
        dir: "./lib",
        sourcemap: true,
        compact: true,
    },
    plugins: [
        del({ targets: "lib/*" }),
        typescript({
            sourceMap: true,
        }),
        commonjs(),
        inject({
            process: "process/browser",
        }),
        json(),
        resolve({
            browser: true,
            preferBuiltins: false,
            dedupe: ["@dfinity/candid"],
        }),
        terser(),
    ],
};
