/* eslint-disable no-undef */
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import inject from "rollup-plugin-inject";
import json from "@rollup/plugin-json";
import replace from "@rollup/plugin-replace";
import * as path from "path";
import * as rimraf from "rimraf";

const production = !process.env.ROLLUP_WATCH;
const env = process.env.NODE_ENV ?? (production ? "production" : "development");
console.log("PROD", production);

function clean() {
    return {
        name: "clean-build",
        buildStart() {
            console.log("cleaning up the lib directory");
            rimraf.sync(path.join(__dirname, "lib"));
        },
    };
}

export default {
    input: `./src/index.ts`,
    output: {
        format: "es",
        dir: "./lib",
    },
    external: ["url"],
    plugins: [
        clean(),
        resolve({
            preferBuiltins: false,
            browser: true,
            dedupe: ["svelte"],
        }),
        commonjs(),
        typescript({
            sourceMap: !production,
            inlineSources: !production,
        }),
        inject({
            Buffer: ["buffer", "Buffer"],
            process: "process/browser",
        }),
        json(),
        replace({
            preventAssignment: true,
            "process.env.NODE_ENV": JSON.stringify(env),
        }),
    ],
    watch: {
        clearScreen: false,
    },
};
