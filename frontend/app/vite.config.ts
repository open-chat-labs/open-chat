import fs from "fs";
import path from "path";
import replace from "@rollup/plugin-replace";
import dfxJson from "../../dfx.json";
import { defineConfig, type PluginOption } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { createHtmlPlugin } from "vite-plugin-html";
import chokidar, { FSWatcher } from "chokidar";
import {
    sassModulesAndMixins,
    generateCspForScripts,
    initEnv,
    __dirname,
} from "./rollup.extras.mjs";

const version = `1000.0.${Date.now()}`;
const inlineScripts = [`window.OC_WEBSITE_VERSION = "${version}";`];
process.env.OC_WEBSITE_VERSION = version;

initEnv();

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
        cors: true,
        hmr: {
            host: "localhost",
            protocol: "ws",
        },
        proxy: {
            "/api": `http://${dfxJson.networks.local.bind}`,
        },
        headers: {
            "Cache-Control": "no-store",
        }
    },
    plugins: [
        svelte() as PluginOption,
        replace({
            "process.env": "import.meta.env",
            preventAssignment: true,
        }) as PluginOption,
        {
            name: "worker-file-server",
            configureServer(server) {
                server.middlewares.use((req, res, next) => {
                    const serveFile = (fileName: string, relativePath: string) => {
                        const fullPath = path.resolve(__dirname, relativePath, fileName);

                        if (fs.existsSync(fullPath)) {
                            res.setHeader("Content-Type", "text/javascript");
                            fs.createReadStream(fullPath).pipe(res);
                            return true;
                        } else {
                            console.warn(`'${fileName}' is not available!`);
                            return false;
                        }
                    };

                    if (req.url?.startsWith("/worker.js")) {
                        if (
                            serveFile(
                                "worker.js",
                                path.resolve(__dirname, "../openchat-worker/lib/"),
                            )
                        ) {
                            return;
                        }
                    }

                    next();
                });
            },
        },
        {
            name: "watch-oc-deps-and-reload",
            configureServer(server) {
                new ReloadFileWatcher(() => server.ws.send({ type: "full-reload" }));
            },
        },
        createHtmlPlugin({
            minify: true,
            entry: "./src/main.ts",
            inject: {
                data: {
                    injectScript: inlineScripts.map((s) => `<script>${s}</script>`).join(""),
                    csp: `<meta http-equiv="Content-Security-Policy" content="${generateCspForScripts(
                        inlineScripts,
                        true,
                    )}" />`,
                },
            },
        }),
    ],
    resolve: {
        alias: {
            "@src": path.resolve(__dirname, "./src"),
            "@actions": path.resolve(__dirname, "./src/actions"),
            "@components": path.resolve(__dirname, "./src/components"),
            "@i18n": path.resolve(__dirname, "./src/i18n"),
            "@stores": path.resolve(__dirname, "./src/stores"),
            "@theme": path.resolve(__dirname, "./src/theme"),
            "@utils": path.resolve(__dirname, "./src/utils"),
            "@styles": path.resolve(__dirname, "./src/styles"),
        },
    },
    css: {
        preprocessorOptions: {
            scss: {
                additionalData: sassModulesAndMixins,
            },
        },
    },
});

const INTERVAL = 1000;
const MAX_ITERATIONS = 100;

export class ReloadFileWatcher {
    // There is no need to monitor agent as it always causes worker to change
    // There is no need to monitor shared as it always causes worker & client to change
    #dirs = ["../openchat-client/lib/", "../openchat-worker/lib/"];
    #files = [
        "../openchat-agent/lib/index.js",
        "../openchat-client/lib/index.js",
        "../openchat-shared/lib/index.js",
        "../openchat-worker/lib/worker.js",
    ];
    #watcher: FSWatcher;
    #timer?: ReturnType<typeof setTimeout>;
    #iterations = 0;
    #reload: () => void;

    constructor(reload: () => void) {
        this.#reload = reload;
        this.#watcher = chokidar.watch(this.#dirs, {
            persistent: true,
            awaitWriteFinish: true,
        });

        //@ts-ignore
        this.#watcher.on("change", (path) => this.#fileChanged(path));
        //@ts-ignore
        this.#watcher.on("add", (path) => this.#fileAdded(path));
    }

    #fileAdded(path: string) {
        console.log("File added: ", path);
        this.#initiateFileCheck();
    }

    #fileChanged(path: string) {
        console.log("File changed: ", path);
        this.#initiateFileCheck();
    }

    #stopChecking() {
        clearInterval(this.#timer);
        this.#iterations = 0;
    }

    #initiateFileCheck() {
        this.#stopChecking();
        this.#timer = setInterval(() => this.#checkFilesExist(), INTERVAL);
    }

    #checkFilesExist() {
        const [present, missing] = this.#files.reduce(
            ([p, m], f) => {
                if (fs.existsSync(f)) {
                    p.push(f);
                } else {
                    m.push(f);
                }
                return [p, m];
            },
            [[], []] as [string[], string[]],
        );
        if (present.length === this.#files.length) {
            console.log("All files present - reloading: ", this.#iterations);
            this.#reload();
            clearInterval(this.#timer);
        } else {
            console.log("Not all files are there", missing);
            this.#iterations += 1;
            if (this.#iterations > MAX_ITERATIONS) {
                console.error("We have waited too long. Giving up.");
                this.#stopChecking();
            }
        }
    }
}
