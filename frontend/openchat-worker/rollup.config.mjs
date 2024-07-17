import commonjs from "@rollup/plugin-commonjs";
import inject from "@rollup/plugin-inject";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import del from "rollup-plugin-delete";
import { sourcemapNewline } from "../sourcemapNewline.mjs";

export default {
    input: `./src/worker.ts`,
    output: {
        dir: "./lib",
        sourcemap: true,
        compact: true,
    },
    plugins: [
        del({ targets: "lib/*" }),
        typescript(),
        commonjs(),
        inject({
            process: "process/browser",
        }),
        json(),
        resolve({
            browser: true,
            preferBuiltins: false,
        }),
        terser(),
        sourcemapNewline(),
    ],
};
