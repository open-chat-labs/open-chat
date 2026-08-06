import replace from "@rollup/plugin-replace";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import chokidar from "chokidar";
import fs from "fs";
import path from "path";
import execute from "rollup-plugin-shell";
import { build, defineConfig, type Plugin, type PluginOption } from "vite";
import { createHtmlPlugin } from "vite-plugin-html";
import dfxJson from "../../dfx.json";
import {
    __dirname,
    generateCspForScripts,
    initEnv,
    sassModulesAndMixins,
} from "./rollup.extras.mjs";
import { ocPackageAliases } from "./oc-package-aliases.mjs";

const version = `1000.0.${Date.now()}`;
const inlineScripts = [`window.OC_WEBSITE_VERSION = "${version}";`];
process.env.OC_WEBSITE_VERSION = version;

initEnv();

const isNativeIos = process.env.OC_APP_TYPE === "ios";
const isNativeAndroid = process.env.OC_APP_TYPE === "android";
const isNativeApp = isNativeIos || isNativeAndroid;
// Dev server port — shared by web and native (Android/iOS) dev.
const port = Number(process.env.OC_DEV_PORT) || 5001;

// The former workspace sub-packages (@shared/@client/@agent/@worker) resolve
// directly from their TypeScript source via `ocPackageAliases` — see
// ./oc-package-aliases.mjs, the single source shared with build-workers.mjs.

// Directory (gitignored, under node_modules) where the dev web worker bundle is
// emitted before being served at /worker.js.
const workerBuildDir = path.resolve(__dirname, "node_modules/.oc-worker");
const workerEntry = path.resolve(__dirname, "../openchat-worker/src/worker.ts");

// Builds the web worker from TypeScript source — reusing the sub-package
// aliases so it pulls agent/shared from source too — and serves it at
// /worker.js, rebuilding and triggering a full reload when worker/agent/shared
// source changes. Replaces serving the Turbo-compiled
// openchat-worker/lib/worker.js together with the chokidar poll that waited for
// those lib files to appear.
function ocWorkerPlugin(): Plugin {
    async function buildWorker() {
        await build({
            configFile: false,
            logLevel: "warn",
            resolve: { alias: ocPackageAliases },
            define: { "process.env.NODE_ENV": JSON.stringify("development") },
            build: {
                outDir: workerBuildDir,
                emptyOutDir: false,
                target: "es2020",
                minify: false,
                sourcemap: true,
                lib: {
                    entry: workerEntry,
                    formats: ["es"],
                    fileName: () => "worker.js",
                },
            },
        });
    }

    return {
        name: "oc-worker",
        async configureServer(server) {
            await buildWorker();

            // Serve the built worker (and its sourcemap) regardless of the ?v=
            // cache-busting query string the client appends.
            server.middlewares.use((req, res, next) => {
                const fileName = path.basename((req.url ?? "").split("?")[0]);
                const filePath = path.join(workerBuildDir, fileName);
                if (
                    (fileName === "worker.js" || fileName === "worker.js.map") &&
                    fs.existsSync(filePath)
                ) {
                    res.setHeader(
                        "Content-Type",
                        fileName.endsWith(".map") ? "application/json" : "text/javascript",
                    );
                    fs.createReadStream(filePath).pipe(res);
                    return;
                }
                next();
            });

            // Rebuild the worker when its source (or the agent/shared code it
            // bundles) changes, then full-reload the page.
            const watchDirs = [
                "../openchat-worker/src",
                "../openchat-agent/src",
                "../openchat-shared/src",
            ].map((d) => path.resolve(__dirname, d));

            let timer: ReturnType<typeof setTimeout> | undefined;
            const watcher = chokidar.watch(watchDirs, {
                ignoreInitial: true,
                awaitWriteFinish: true,
            });
            const rebuild = () => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    buildWorker()
                        .then(() => server.ws.send({ type: "full-reload" }))
                        .catch((err) =>
                            server.config.logger.error(`[oc-worker] rebuild failed: ${err}`),
                        );
                }, 150);
            };
            watcher.on("change", rebuild).on("add", rebuild).on("unlink", rebuild);
            server.httpServer?.on("close", () => void watcher.close());
        },
    };
}

// TODO use vite for prod build!
// https://vite.dev/config/
export default defineConfig({
    envPrefix: "OC_",
    define: {
        "import.meta.env.OC_AIRDROP_BOT_CANISTER": JSON.stringify(
            "this-is-not-the-value-youre-looking-for",
        ),
        "import.meta.env.OC_WEBSITE_VERSION": JSON.stringify(version),
    },
    server: {
        allowedHosts: ["host.docker.internal"],
        host: true,
        cors: true,
        port,
        strictPort: true,
        hmr: {
            protocol: "ws",
            port,
            clientPort: port,
        },
        proxy: isNativeApp
            ? undefined
            : {
                  "/api": `http://${dfxJson.networks.local.bind}`,
              },
        headers: {
            "Cache-Control": "no-store",
        },
    },
    build: isNativeApp
        ? {
              // Tauri uses Chromium on Windows and WebKit on macOS and Linux
              target: "safari13",
              //   process.env.TAURI_ENV_PLATFORM == 'windows'
              //     ? 'chrome105'
              //     : 'safari13',
              // don't minify for debug builds
              minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
              // produce sourcemaps for debug builds
              sourcemap: !!process.env.TAURI_ENV_DEBUG,
          }
        : undefined,
    plugins: [
        svelte() as PluginOption,
        replace({
            "process.env": "import.meta.env",
            preventAssignment: true,
        }) as PluginOption,
        ocWorkerPlugin(),
        createHtmlPlugin({
            minify: true,
            entry: "./src/main.ts",
            inject: {
                data: {
                    injectScript: inlineScripts.map((s) => `<script>${s}</script>`).join(""),
                    csp: `<meta http-equiv="Content-Security-Policy" content="${generateCspForScripts(
                        inlineScripts,
                        true,
                    )}" />\n`,
                },
            },
        }),
        execute({
            commands: [
                `../../scripts/get-public-key.sh ${process.env.OC_DFX_NETWORK} > ./public/public-key`,
            ],
            hook: "buildStart",
        }),
    ],
    resolve: {
        alias: [
            ...ocPackageAliases,
            // The Tauri plugin's guest JS is resolved from source (guest-js/)
            // rather than its built dist-js output, like the sub-packages above.
            {
                find: /^tauri-plugin-oc-api\/(.*)$/,
                replacement: path.join(path.resolve(__dirname, "../tauri-plugin-oc/guest-js"), "$1"),
            },
            {
                find: /^tauri-plugin-oc-api$/,
                replacement: path.resolve(__dirname, "../tauri-plugin-oc/guest-js/index.ts"),
            },
            { find: "@dfinity/agent", replacement: "@icp-sdk/core/agent" },
            { find: "@dfinity/auth-client", replacement: "@icp-sdk/auth/client" },
            { find: "@src", replacement: path.resolve(__dirname, "./src") },
            { find: "@actions", replacement: path.resolve(__dirname, "./src/actions") },
            { find: "@i18n", replacement: path.resolve(__dirname, "./src/i18n") },
            {
                find: "@shared_components",
                replacement: path.resolve(__dirname, "./src/components_shared"),
            },
            { find: "@stores", replacement: path.resolve(__dirname, "./src/stores") },
            { find: "@theme", replacement: path.resolve(__dirname, "./src/theme") },
            { find: "@utils", replacement: path.resolve(__dirname, "./src/utils") },
            { find: "@styles", replacement: path.resolve(__dirname, "./src/styles") },
        ],
    },
    css: {
        preprocessorOptions: {
            scss: {
                additionalData: sassModulesAndMixins,
            },
        },
    },
});
