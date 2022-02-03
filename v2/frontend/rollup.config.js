/* eslint-disable no-undef */
import svelte from "rollup-plugin-svelte";
import sveltePreprocess from "svelte-preprocess";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import livereload from "rollup-plugin-livereload";
import { terser } from "rollup-plugin-terser";
import typescript from "@rollup/plugin-typescript";
import css from "rollup-plugin-css-only";
import dfxJson from "../dfx.json";
import inject from "rollup-plugin-inject";
import dev from "rollup-plugin-dev";
import json from "@rollup/plugin-json";
import analyze from "rollup-plugin-analyzer";
import filesize from "rollup-plugin-filesize";
// import copy from 'rollup-plugin-copy';
import dotenv from "dotenv";
import replace from "@rollup/plugin-replace";
import * as fs from "fs";
import * as path from "path";
import * as rimraf from "rimraf";

dotenv.config();

const dfxNetwork = process.env.DFX_NETWORK;

console.log("DFX_NETWORK: ", dfxNetwork);

if (dfxNetwork) {
    const canisterPath =
        dfxNetwork.startsWith("ic")
            ? path.join(__dirname, "..", "canister_ids.json")
            : path.join(__dirname, "..", ".dfx", dfxNetwork, "canister_ids.json");

    if (fs.existsSync(canisterPath)) {
        const canisters = JSON.parse(fs.readFileSync(canisterPath));
        process.env.USER_INDEX_CANISTER = canisters.user_index[dfxNetwork];
        process.env.GROUP_INDEX_CANISTER = canisters.group_index[dfxNetwork];
        process.env.NOTIFICATIONS_CANISTER = canisters.notifications[dfxNetwork];
        process.env.ONLINE_CANISTER = canisters.online_users_aggregator[dfxNetwork];

        console.log("UserIndexCanisterId: ", process.env.USER_INDEX_CANISTER);
        console.log("GroupIndexCanisterId: ", process.env.GROUP_INDEX_CANISTER);
        console.log("NotificationsCanisterId: ", process.env.NOTIFICATIONS_CANISTER);
        console.log("OnlineCanisterId: ", process.env.ONLINE_CANISTER);
    } else {
        console.log(
            "Couldn't find canisters JSON at: ",
            canisterPath,
            ". Falling back to original env vars."
        );
    }
} else {
    console.log(
        "DFX_NETWORK env var not set, cannot load correct canisterIds, falling back to original env vars."
    );
}

// todo - we should add some code here to validate that the env vars we are expecting are actually present

const production = !process.env.ROLLUP_WATCH;
const env = process.env.NODE_ENV ?? (production ? "production" : "development");

const WEBPUSH_SERVICE_WORKER_PATH = "_/raw/sw.js";

console.log("PROD", production);
console.log("ENV", env);
console.log("URL", process.env.INTERNET_IDENTITY_URL);

function serve() {
    return dev({
        dirs: ["./public"],
        proxy: [
            {
                from: "/api/*",
                to: `http://${dfxJson.networks.local.bind}`,
            },
        ],
        spa: "./public/index.html",
        port: process.env.DEV_PORT || 5000,
    });
}

rimraf.sync(path.join(__dirname, "public", "build"));

export default [
    {
        input: "./src/sw/index.ts",
        output: {
            file: "public/_/raw/sw.js",
            sourcemap: true,
            format: "iife",
        },
        plugins: [
            commonjs(),
            typescript({
                sourceMap: !production,
                inlineSources: !production,
            }),
            resolve({
                preferBuiltins: false,
                browser: true,
                dedupe: ["svelte"],
            }),
            replace({
                preventAssignment: true,
                "process.env.NODE_ENV": JSON.stringify(env),
            }),

            production && terser(),
        ],
    },
    {
        input: `./src/main.ts`,
        output: {
            sourcemap: true,
            format: "es",
            name: "app",
            dir: "public/build",
        },
        plugins: [
            svelte({
                preprocess: sveltePreprocess({
                    sourceMap: !production,
                    scss: {
                        prependData: `@use 'sass:math'; @import 'src/styles/mixins.scss';`,
                    },
                }),
                compilerOptions: {
                    dev: !production,
                    // immutable: true, // this could be a great optimisation, but we need to plan for it a bit
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
                "process.env.INTERNET_IDENTITY_URL": JSON.stringify(
                    process.env.INTERNET_IDENTITY_URL
                ),
                "process.env.NODE_ENV": JSON.stringify(env),
                "process.env.ROLLBAR_ACCESS_TOKEN": process.env.ROLLBAR_ACCESS_TOKEN,
                "process.env.CLIENT_CACHING": process.env.CLIENT_CACHING,
                "process.env.MOCK_SERVICES": !production && process.env.MOCK_SERVICES, // make double sure we don't release with mock data
                "process.env.USER_INDEX_CANISTER": process.env.USER_INDEX_CANISTER,
                "process.env.GROUP_INDEX_CANISTER": process.env.GROUP_INDEX_CANISTER,
                "process.env.NOTIFICATIONS_CANISTER": process.env.NOTIFICATIONS_CANISTER,
                "process.env.ONLINE_CANISTER": process.env.ONLINE_CANISTER,
                "process.env.OPEN_STORAGE_INDEX_CANISTER": process.env.OPEN_STORAGE_INDEX_CANISTER,
                "process.env.LEDGER_CANISTER": process.env.LEDGER_CANISTER,
                "process.env.BLOB_URL_PATTERN": process.env.BLOB_URL_PATTERN,
                "process.env.WEBPUSH_SERVICE_WORKER_PATH": WEBPUSH_SERVICE_WORKER_PATH,
                "process.env.USERGEEK_APIKEY": process.env.USERGEEK_APIKEY,
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

            production && analyze({ summaryOnly: true }),

            production && filesize(),
        ],
        watch: {
            clearScreen: false,
        },
    },
];
