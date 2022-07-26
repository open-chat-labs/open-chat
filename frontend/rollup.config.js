/* eslint-disable no-undef */
import svelte from "rollup-plugin-svelte";
import sveltePreprocess from "svelte-preprocess";
import commonjs from "@rollup/plugin-commonjs";
import html from "@rollup/plugin-html";
import resolve from "@rollup/plugin-node-resolve";
import copy from "rollup-plugin-copy";
import livereload from "rollup-plugin-livereload";
import { terser } from "rollup-plugin-terser";
import typescript from "@rollup/plugin-typescript";
import dfxJson from "../dfx.json";
import inject from "rollup-plugin-inject";
import dev from "rollup-plugin-dev";
import json from "@rollup/plugin-json";
import analyze from "rollup-plugin-analyzer";
import filesize from "rollup-plugin-filesize";
import postcss from "rollup-plugin-postcss";
import { sha256 } from "js-sha256";
import dotenv from "dotenv";
import replace from "@rollup/plugin-replace";
import * as fs from "fs";
import * as path from "path";
import * as rimraf from "rimraf";
import assetHeaders from "./.ic-assets.json";

dotenv.config();

const dfxNetwork = process.env.DFX_NETWORK;

console.log("DFX_NETWORK: ", dfxNetwork);

if (dfxNetwork) {
    const canisterPath = dfxNetwork.startsWith("ic")
        ? path.join(__dirname, "..", "canister_ids.json")
        : path.join(__dirname, "..", ".dfx", dfxNetwork, "canister_ids.json");

    if (fs.existsSync(canisterPath)) {
        const canisters = JSON.parse(fs.readFileSync(canisterPath));
        process.env.USER_INDEX_CANISTER = canisters.user_index[dfxNetwork];
        process.env.GROUP_INDEX_CANISTER = canisters.group_index[dfxNetwork];
        process.env.NOTIFICATIONS_CANISTER = canisters.notifications[dfxNetwork];
        process.env.ONLINE_CANISTER = canisters.online_users_aggregator[dfxNetwork];
        process.env.PROPOSALS_BOT_CANISTER = canisters.proposals_bot[dfxNetwork];

        console.log("UserIndexCanisterId: ", process.env.USER_INDEX_CANISTER);
        console.log("GroupIndexCanisterId: ", process.env.GROUP_INDEX_CANISTER);
        console.log("NotificationsCanisterId: ", process.env.NOTIFICATIONS_CANISTER);
        console.log("OnlineCanisterId: ", process.env.ONLINE_CANISTER);
        console.log("ProposalsBotCanisterId: ", process.env.PROPOSALS_BOT_CANISTER);
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

const production = !process.env.ROLLUP_WATCH;
const env = process.env.NODE_ENV ?? (production ? "production" : "development");
const version = process.env.OPENCHAT_WEBSITE_VERSION;
if (production && !version) {
    throw Error("OPENCHAT_WEBSITE_VERSION environment variable not set");
}
if (production && !process.env.ROLLBAR_ACCESS_TOKEN) {
    throw Error("ROLLBAR_ACCESS_TOKEN environment variable not set");
}
if (production && !process.env.USERGEEK_APIKEY) {
    throw Error("USERGEEK_APIKEY environment variable not set");
}
const WEBPUSH_SERVICE_WORKER_PATH = env === "development" ? "sw.js" : "_/raw/sw.js";

console.log("PROD", production);
console.log("ENV", env);
console.log("INTERNET IDENTITY URL", process.env.INTERNET_IDENTITY_URL);
console.log("VERSION", version ?? "undefined");

function serve() {
    return dev({
        dirs: ["./build", "./public"],
        proxy: [
            {
                from: "/api/*",
                to: `http://${dfxJson.networks.local.bind}`,
            },
        ],
        spa: "./index.html",
        port: process.env.DEV_PORT || 5000,
    });
}

rimraf.sync(path.join(__dirname, "build"));
fs.mkdirSync("build");

if (version) {
    fs.writeFileSync("build/version", JSON.stringify({ version }));
}

fs.writeFileSync("build/.ic-assets.json", JSON.stringify(assetHeaders));

const iiAlternativeOrigin = process.env.II_ALTERNATIVE_ORIGIN;
if (iiAlternativeOrigin !== undefined) {
    fs.mkdirSync("build/.well-known");
    fs.writeFileSync(
        "build/.well-known/ii-alternative-origins",
        JSON.stringify({
            alternativeOrigins: [iiAlternativeOrigin],
        })
    );
}

export default [
    {
        input: "./src/sw/index.ts",
        output: {
            file: "build/" + WEBPUSH_SERVICE_WORKER_PATH,
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
                "process.env.OPENCHAT_WEBSITE_VERSION": JSON.stringify(version),
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
            dir: "build",
            entryFileNames: "[name]-[hash].js",
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

            postcss({ extract: true }),

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
                "process.env.DFX_NETWORK": JSON.stringify(dfxNetwork),
                "process.env.NODE_ENV": JSON.stringify(env),
                "process.env.OPENCHAT_WEBSITE_VERSION": JSON.stringify(version),
                "process.env.ROLLBAR_ACCESS_TOKEN": process.env.ROLLBAR_ACCESS_TOKEN,
                "process.env.CLIENT_CACHING": process.env.CLIENT_CACHING,
                "process.env.IC_URL": maybeStringify(process.env.IC_URL),
                "process.env.II_DERIVATION_ORIGIN": maybeStringify(
                    process.env.II_DERIVATION_ORIGIN
                ),
                "process.env.USER_INDEX_CANISTER": process.env.USER_INDEX_CANISTER,
                "process.env.GROUP_INDEX_CANISTER": process.env.GROUP_INDEX_CANISTER,
                "process.env.NOTIFICATIONS_CANISTER": process.env.NOTIFICATIONS_CANISTER,
                "process.env.ONLINE_CANISTER": process.env.ONLINE_CANISTER,
                "process.env.PROPOSALS_BOT_CANISTER": process.env.PROPOSALS_BOT_CANISTER,
                "process.env.OPEN_STORAGE_INDEX_CANISTER": process.env.OPEN_STORAGE_INDEX_CANISTER,
                "process.env.LEDGER_CANISTER_ICP": process.env.LEDGER_CANISTER_ICP,
                "process.env.LEDGER_CANISTER_BTC": process.env.LEDGER_CANISTER_BTC,
                "process.env.LEDGER_CANISTER_CHAT": process.env.LEDGER_CANISTER_CHAT,
                "process.env.ENABLE_MULTI_CRYPTO": process.env.ENABLE_MULTI_CRYPTO,
                "process.env.BLOB_URL_PATTERN": process.env.BLOB_URL_PATTERN,
                "process.env.WEBPUSH_SERVICE_WORKER_PATH": WEBPUSH_SERVICE_WORKER_PATH,
                "process.env.USERGEEK_APIKEY": process.env.USERGEEK_APIKEY,
                "process.env.GIPHY_APIKEY": JSON.stringify(process.env.GIPHY_APIKEY),
                "process.env.PUBLIC_TRANSLATE_API_KEY": JSON.stringify(
                    process.env.PUBLIC_TRANSLATE_API_KEY
                ),
            }),

            html({
                template: ({ files }) => {
                    const jsEntryFile = files.js.find((f) => f.isEntry).fileName;
                    const cssFile = files.css[0].fileName;

                    function generateCspHashValue(text) {
                        const hash = sha256.update(text).arrayBuffer();
                        const base64 = Buffer.from(hash).toString("base64");
                        return `'sha256-${base64}'`;
                    }

                    const inlineScripts = [
                        `window.OPENCHAT_WEBSITE_VERSION = "${version}";`,
                        `var parcelRequire;`,
                    ];
                    const cspHashValues = inlineScripts.map(generateCspHashValue);
                    let csp = `script-src 'self' 'unsafe-eval' https://api.rollbar.com/api/ ${cspHashValues.join(
                        " "
                    )}`;
                    if (!production) {
                        csp += " http://localhost:* http://127.0.0.1:*";
                    }

                    return `
                        <!DOCTYPE html>
                        <html lang="en">
                            <head>
                                <meta http-equiv="Content-Security-Policy" content="${csp}" />
                                <meta charset="utf-8" />
                                <meta name="viewport" content="width=device-width, initial-scale=1">
                                <meta name="apple-mobile-web-app-title" content="OpenChat" />
                                <title>OpenChat</title>
                                <link rel="manifest" href="/openchat.webmanifest" />
                                <link rel="apple-touch-startup-image" href="/_/raw/apple-touch-icon.png" />
                                <link rel="apple-touch-icon" href="/_/raw/apple-touch-icon.png" />
                                <link rel="icon" type="image/png" href="/icon.png" />
                                <link rel="stylesheet" href="/global.css" />
                                <link rel="stylesheet" href="/${cssFile}" />
                                <script type="module" defer src="/${jsEntryFile}"></script>
                                ${inlineScripts.map((s) => `<script>${s}</script>`).join("")}
                            </head>
                            <body></body>
                        </html>
                    `;
                },
            }),

            // In dev mode, call `npm run start` once
            // the bundle has been generated
            !production && serve(),

            // Watch the `public` directory and refresh the
            // browser on changes when not in production
            !production && livereload("build"),

            // If we're building for production (npm run build
            // instead of npm run dev), minify
            production && terser(),

            production && analyze({ summaryOnly: true }),

            production && filesize(),

            // If we're building for production, copy sourcemaps to '_/raw'
            // and update the js files to point to the new sourcemap locations
            production &&
                copy({
                    targets: [
                        {
                            src: "build/*.map",
                            dest: "build/_/raw",
                        },
                        {
                            src: "build/*.js",
                            dest: "build",
                            transform: (contents, filename) =>
                                contents
                                    .toString()
                                    .replace(
                                        "//# sourceMappingURL=",
                                        "//# sourceMappingURL=./_/raw/"
                                    ),
                        },
                    ],
                    hook: "writeBundle",
                }),
        ],
        watch: {
            clearScreen: false,
        },
    },
];

function maybeStringify(value) {
    return value !== undefined ? JSON.stringify(value) : undefined;
}
