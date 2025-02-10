/* eslint-disable no-undef */
import svelte from "rollup-plugin-svelte";
import { sveltePreprocess } from "svelte-preprocess";
import commonjs from "@rollup/plugin-commonjs";
import html from "@rollup/plugin-html";
import resolve from "@rollup/plugin-node-resolve";
import copy from "rollup-plugin-copy";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import inject from "rollup-plugin-inject";
import json from "@rollup/plugin-json";
import analyze from "rollup-plugin-analyzer";
import filesize from "rollup-plugin-filesize";
import styles from "rollup-styles";
import alias from "@rollup/plugin-alias";
import autoprefixer from "autoprefixer";
import replace from "@rollup/plugin-replace";
import fs from "fs-extra";
import path from "path";
import rimraf from "rimraf";
import { sourcemapNewline } from "../sourcemapNewline.mjs";
import {
    initEnv,
    manualChunks,
    copyFile,
    generateCspForScripts,
    maybeStringify,
    __dirname
} from "./rollup.extras.mjs";


// this is a bit ridiculous but there we are ...
function clean() {
    return {
        name: "clean-build",
        renderStart() {
            console.log("cleaning up the build directory");
            rimraf.sync(path.join(__dirname, "build"));
            fs.mkdirSync("build");
            if (version) {
                fs.writeFileSync("build/version", JSON.stringify({ version }));
            }
            const customDomains = process.env.OC_CUSTOM_DOMAINS;
            if (customDomains !== undefined) {
                fs.mkdirSync("build/.well-known");
                fs.writeFileSync(
                    "build/.well-known/ii-alternative-origins",
                    JSON.stringify({
                        alternativeOrigins: customDomains.split(",").map((d) => `https://${d}`),
                    }),
                );
                fs.writeFileSync(
                    "build/.well-known/ic-domains",
                    customDomains.split(",").join("\n"),
                );
            }
            copyFile(".", "build", ".ic-assets.json5");
        },
    };
}


const { version } = initEnv();

export default {
    input: `./src/main.ts`,
    output: {
        sourcemap: true,
        format: "es",
        name: "app",
        dir: "build",
        entryFileNames: "[name]-[hash].js",
        manualChunks,
    },
    plugins: [
        clean(),
        svelte({
            preprocess: sveltePreprocess({
                sourceMap: true,
                scss: {
                    prependData: `@use 'sass:math'; @use 'src/styles/mixins.scss' as *;`,
                },
            }),
            compilerOptions: {
                // immutable: true, // this could be a great optimisation, but we need to plan for it a bit
            },
            onwarn: (warning, handler) => {
                if (warning.code.startsWith("a11y-")) return;
                handler(warning);
            },
        }),

        alias({
            entries: [
                { find: "@src", replacement: path.resolve(__dirname, "src") },
                { find: "@actions", replacement: path.resolve(__dirname, "src/actions") },
                { find: "@components", replacement: path.resolve(__dirname, "src/components") },
                { find: "@i18n", replacement: path.resolve(__dirname, "src/i18n") },
                { find: "@stores", replacement: path.resolve(__dirname, "src/stores") },
                { find: "@theme", replacement: path.resolve(__dirname, "src/theme") },
                { find: "@utils", replacement: path.resolve(__dirname, "src/utils") },
                { find: "@styles", replacement: path.resolve(__dirname, "src/styles") },
            ],
        }),

        styles({ mode: "inject", plugins: [autoprefixer()] }),

        resolve({
            preferBuiltins: false,
            browser: true,
            dedupe: ["svelte"],
        }),
        commonjs(),
        typescript({
            include: ["./src/**/*", "../vite-env.d.ts"],
        }),
        inject({
            Buffer: ["buffer", "Buffer"],
            process: "process/browser",
        }),
        json(),

        replace({
            preventAssignment: true,
            "import.meta.env.OC_BUILD_ENV": JSON.stringify(process.env.OC_BUILD_ENV),
            "import.meta.env.OC_INTERNET_IDENTITY_URL": JSON.stringify(process.env.OC_INTERNET_IDENTITY_URL),
            "import.meta.env.OC_INTERNET_IDENTITY_CANISTER_ID": JSON.stringify(
                process.env.OC_INTERNET_IDENTITY_CANISTER_ID,
            ),
            "import.meta.env.OC_NFID_URL": JSON.stringify(process.env.OC_NFID_URL),
            "import.meta.env.OC_DFX_NETWORK": JSON.stringify(process.env.OC_DFX_NETWORK),
            "import.meta.env.OC_NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "production"),
            "import.meta.env.OC_WEBSITE_VERSION": JSON.stringify(process.env.OC_WEBSITE_VERSION),
            "import.meta.env.OC_ROLLBAR_ACCESS_TOKEN": JSON.stringify(process.env.OC_ROLLBAR_ACCESS_TOKEN),
            "import.meta.env.OC_IC_URL": maybeStringify(process.env.OC_IC_URL),
            "import.meta.env.OC_II_DERIVATION_ORIGIN": maybeStringify(process.env.OC_II_DERIVATION_ORIGIN),
            "import.meta.env.OC_USER_INDEX_CANISTER": JSON.stringify(process.env.OC_USER_INDEX_CANISTER),
            "import.meta.env.OC_TRANSLATIONS_CANISTER": JSON.stringify(process.env.OC_TRANSLATIONS_CANISTER),
            "import.meta.env.OC_GROUP_INDEX_CANISTER": JSON.stringify(process.env.OC_GROUP_INDEX_CANISTER),
            "import.meta.env.OC_NOTIFICATIONS_CANISTER": JSON.stringify(
                process.env.OC_NOTIFICATIONS_CANISTER,
            ),
            "import.meta.env.OC_IDENTITY_CANISTER": JSON.stringify(process.env.OC_IDENTITY_CANISTER),
            "import.meta.env.OC_ONLINE_CANISTER": JSON.stringify(process.env.OC_ONLINE_CANISTER),
            "import.meta.env.OC_PROPOSALS_BOT_CANISTER": JSON.stringify(
                process.env.OC_PROPOSALS_BOT_CANISTER,
            ),
            "import.meta.env.OC_AIRDROP_BOT_CANISTER": JSON.stringify(process.env.OC_AIRDROP_BOT_CANISTER),
            "import.meta.env.OC_STORAGE_INDEX_CANISTER": JSON.stringify(
                process.env.OC_STORAGE_INDEX_CANISTER,
            ),
            "import.meta.env.OC_REGISTRY_CANISTER": JSON.stringify(process.env.OC_REGISTRY_CANISTER),
            "import.meta.env.OC_MARKET_MAKER_CANISTER": JSON.stringify(process.env.OC_MARKET_MAKER_CANISTER),
            "import.meta.env.OC_SIGN_IN_WITH_EMAIL_CANISTER": JSON.stringify(
                process.env.OC_SIGN_IN_WITH_EMAIL_CANISTER,
            ),
            "import.meta.env.OC_SIGN_IN_WITH_ETHEREUM_CANISTER": JSON.stringify(
                process.env.OC_SIGN_IN_WITH_ETHEREUM_CANISTER,
            ),
            "import.meta.env.OC_SIGN_IN_WITH_SOLANA_CANISTER": JSON.stringify(
                process.env.OC_SIGN_IN_WITH_SOLANA_CANISTER,
            ),
            "import.meta.env.OC_BLOB_URL_PATTERN": JSON.stringify(process.env.OC_BLOB_URL_PATTERN),
            "import.meta.env.OC_ACHIEVEMENT_URL_PATH": JSON.stringify(process.env.OC_ACHIEVEMENT_URL_PATH),
            "import.meta.env.OC_USERGEEK_APIKEY": JSON.stringify(process.env.OC_USERGEEK_APIKEY),
            "import.meta.env.OC_VIDEO_BRIDGE_URL": JSON.stringify(process.env.OC_VIDEO_BRIDGE_URL),
            "import.meta.env.OC_PREVIEW_PROXY_URL": JSON.stringify(process.env.OC_PREVIEW_PROXY_URL),
            "import.meta.env.OC_METERED_APIKEY": JSON.stringify(process.env.OC_METERED_APIKEY),
            "import.meta.env.OC_TENOR_APIKEY": JSON.stringify(process.env.OC_TENOR_APIKEY),
            "import.meta.env.OC_CORS_APIKEY": JSON.stringify(process.env.OC_CORS_APIKEY),
            "import.meta.env.OC_PUBLIC_TRANSLATE_API_KEY": JSON.stringify(
                process.env.OC_PUBLIC_TRANSLATE_API_KEY,
            ),
            "import.meta.env.OC_WALLET_CONNECT_PROJECT_ID": JSON.stringify(
                process.env.OC_WALLET_CONNECT_PROJECT_ID,
            ),
            "import.meta.env.OC_SERVICE_WORKER_PATH": process.env.OC_SERVICE_WORKER_PATH,
            "import.meta.env.OC_SUSPICIOUS_USERIDS": process.env.OC_SUSPICIOUS_USERIDS,
        }),

        html({
            template: ({ files }) => {
                const jsEntryFile = files.js.find((f) => f.isEntry).fileName;
                const inlineScripts = [
                    `window.OC_WEBSITE_VERSION = "${version}";`,
                    `var parcelRequire;`,
                ];
                const csp = generateCspForScripts(inlineScripts);

                // TODO this is a duplicate of the index.html file, we should
                // have only one source for our index html.
                return `
                        <!DOCTYPE html>
                        <html lang="en">
                            <head>
                            <!-- Google tag (gtag.js) -->
                                <script async src="https://www.googletagmanager.com/gtag/js?id=G-7P9R6CJLNR"></script>
                                <script>
                                    window.dataLayer = window.dataLayer || [];
                                    function gtag(){dataLayer.push(arguments);}
                                    gtag('js', new Date());
                                    gtag('config', 'G-7P9R6CJLNR');
                                </script>
                                <!-- CLS Tracking Code -->
                                <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                                new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                                'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                                })(window,document,'script','dataLayer','GTM-WQD48GK2');</script>
                                <!-- End CLS Tracking Code -->
                                <meta name="theme-color" media="(prefers-color-scheme: light)" content="#22A7F2" />
                                <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1B1C21" />
                                <meta name="description" content="OpenChat is a fully featured chat application running end-to-end on the Internet Computer blockchain." />
                                <meta property="og:title" content="OpenChat">
                                <meta property="og:type" content="website" />
                                <meta property="og:description" content="OpenChat is a fully featured chat application running end-to-end on the Internet Computer blockchain.">
                                <meta property="og:image" content="https://oc.app/assets/share-oc-light.png">
                                <meta name="twitter:image" content="https://oc.app/assets/share-oc-light.png">
                                <meta property="og:url" content="https://oc.app">
                                <meta name="twitter:card" content="summary_large_image">
                                <meta property="og:site_name" content="OpenChat">
                                <meta name="twitter:image:alt" content="OpenChat is a fully featured chat application running end-to-end on the Internet Computer blockchain.">
                                <meta http-equiv="Content-Security-Policy" content="${csp}" />
                                <meta charset="utf-8" />
                                <meta name="viewport" content="width=device-width, initial-scale=1">
                                <meta name="apple-mobile-web-app-title" content="OpenChat" />
                                <meta name="twitter:widgets:autoload" content="off">
                                <meta name="twitter:dnt" content="on">
                                <meta name="twitter:widgets:csp" content="on">
                                <link rel="canonical" href="/">
                                <title>OpenChat</title>
                                <link rel="manifest" href="/openchat.webmanifest" />
                                <link rel="apple-touch-startup-image" href="/_/raw/apple-touch-icon.png" />
                                <link rel="apple-touch-icon" href="/_/raw/apple-touch-icon.png" />
                                <link rel="icon" type="image/png" href="/icon.png" />
                                <link rel="preconnect" href="https://fonts.googleapis.com" />
                                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
                                <link
                                    href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Bebas+Neue&family=Manrope:wght@400;500;700&family=Roboto:wght@200;300;400;700&display=swap"
                                    rel="stylesheet"
                                />
                                <script type="module" src="https://platform.twitter.com/widgets.js"></script>
                                <script type="module" defer src="/${jsEntryFile}"></script>
                                ${inlineScripts.map((s) => `<script>${s}</script>`).join("")}
                            </head>
                            <template id="profile-link-template" style="cursor: pointer; font-weight: 700; text-decoration: underline;"></template>
                            <body>
                                <!-- CLS Tracking (noscript) -->
                                <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-WQD48GK2" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
                                <!-- End CLS Tracking (noscript) -->
                            </body>
                        </html>
                    `;
            },
        }),

        // We're building for production (npm run build
        // instead of npm run dev), minify
        terser(),
        analyze({ summaryOnly: true }),
        filesize(),

        // Pull in the worker and service worker
        copy({
            targets: [
                {
                    src: "../openchat-worker/lib/*",
                    dest: "build",
                },
                {
                    src: "../openchat-service-worker/lib/*",
                    dest: "build",
                },
            ],
            hook: "generateBundle",
        }),
        sourcemapNewline(),
    ],
    watch: {
        clearScreen: false,
    },
};
