/* eslint-disable no-undef */
import svelte from "rollup-plugin-svelte";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import livereload from "rollup-plugin-livereload";
import alias from "@rollup/plugin-alias";
import { terser } from "rollup-plugin-terser";
import sveltePreprocess from "svelte-preprocess";
import typescript from "@rollup/plugin-typescript";
import css from "rollup-plugin-css-only";
import dfxJson from "../dfx.json";
import path from "path";
import inject from "rollup-plugin-inject";
import dev from "rollup-plugin-dev";
import json from "@rollup/plugin-json";
import analyze from "rollup-plugin-analyzer";
// import copy from 'rollup-plugin-copy';
// import cleaner from 'rollup-plugin-cleaner';
import dotenv from "dotenv";
import replace from "@rollup/plugin-replace";

dotenv.config();

const production = !process.env.ROLLUP_WATCH;

console.log("PROD", production);
console.log("URL", process.env.INTERNET_IDENTITY_URL);

// const aliases = Object.entries(dfxJson.canisters).map(([name, _value]) => {
//     const networkName = process.env["DFX_NETWORK"] || "local";
//     const outputRoot = path.join(
//         __dirname,
//         ".dfx",
//         networkName,
//         "canisters",
//         name
//     );
//     return {
//         find: `dfx-generated/${name}`,
//         replacement: path.join(outputRoot, `${name}.js`)
//     };
// })

const aliases = ["controller", "group", "group_index", "phone_index", "user", "user_index"].map(
    (name) => {
        const find = `api-canisters/${name}/canister`;
        const replacement = path.join(__dirname, "..", "backend", "canisters", name, "canister");

        return {
            find,
            replacement,
        };
    }
);

function serve() {
    return dev({
        dirs: ["./public"],
        proxy: {
            "/api/*": `http://${dfxJson.networks.local.bind}`,
        },
        spa: "./public/index.html",
        port: 5000,
    });
}

export default {
    input: "./src/main.ts",
    output: {
        sourcemap: true,
        format: "es",
        name: "app",
        dir: "public/build",
    },
    plugins: [
        alias({
            entries: [
                ...aliases,
                {
                    find: "react",
                    replacement: require.resolve("preact/compat"),
                },
                {
                    find: "react-dom",
                    replacement: require.resolve("preact/compat"),
                },
            ],
        }),
        svelte({
            preprocess: sveltePreprocess({
                sourceMap: !production,
            }),
            compilerOptions: {
                dev: !production,
            },
        }),

        css({ output: "main.css" }),

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
            "process.env.INTERNET_IDENTITY_URL": JSON.stringify(process.env.INTERNET_IDENTITY_URL),
            "process.env.NODE_ENV": process.env.NODE_ENV,
            "process.env.ROLLBAR_ACCESS_TOKEN": process.env.ROLLBAR_ACCESS_TOKEN,
        }),

        // In dev mode, call `npm run start` once
        // the bundle has been generated
        !production && serve(),

        // Watch the `public` directory and refresh the
        // browser on changes when not in production
        !production && livereload("public"),

        // If we're building for production (npm run build
        // instead of npm run dev), minify
        production && terser(),

        analyze({ summaryOnly: true }),
    ],
    watch: {
        clearScreen: false,
    },
};
