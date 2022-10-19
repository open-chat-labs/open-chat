/* eslint-disable no-undef */
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import inject from "rollup-plugin-inject";
import json from "@rollup/plugin-json";
import replace from "@rollup/plugin-replace";
// import * as fs from "fs";
// import * as path from "path";
// import * as rimraf from "rimraf";

const production = !process.env.ROLLUP_WATCH;
const env = process.env.NODE_ENV ?? (production ? "production" : "development");
console.log("PROD", production);

// if (production) {
//     rimraf.sync(path.join(__dirname, "lib"));
//     fs.mkdirSync("lib");
// }

export default {
    input: `./src/index.ts`,
    output: {
        format: "es",
        dir: "./lib",
    },
    external: ["url"],
    plugins: [
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
            "process.env.CLIENT_CACHING": process.env.CLIENT_CACHING,
        }),
    ],
    watch: {
        clearScreen: false,
    },
};
