/* eslint-disable no-undef */
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import inject from "rollup-plugin-inject";
import json from "@rollup/plugin-json";
import replace from "@rollup/plugin-replace";
import path from "path";
import rimraf from "rimraf";
import { fileURLToPath } from "url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const production = !process.env.ROLLUP_WATCH;
const env = process.env.NODE_ENV ?? (production ? "production" : "development");
console.log("PROD", production);

function clean() {
    return {
        name: "clean-build",
        buildStart() {
            console.log("cleaning up the lib directory");
            rimraf.sync(path.join(dirname, "lib"));
        },
    };
}

// Put external dependencies into their own bundle so that they get cached separately
function manualChunks(id) {
    if (id.includes("node_modules")) {
        return "vendor";
    }
}

export default {
    input: `./src/index.ts`,
    output: {
        dir: "./lib",
        sourcemap: true,
        manualChunks,
    },
    external: ["url"],
    plugins: [
        production && clean(),
        resolve({
            preferBuiltins: false,
            browser: true,
            dedupe: ["svelte"],
        }),
        commonjs(),
        typescript(),
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
