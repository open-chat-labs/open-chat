import replace from "@rollup/plugin-replace";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import chokidar from "chokidar";
import fs from "fs";
import http from "node:http";
import path from "path";
import { build, defineConfig, type Plugin, type PluginOption } from "vite";
import { createHtmlPlugin } from "vite-plugin-html";
import dfxJson from "../../dfx.json";
import {
    __dirname,
    generateCspForScripts,
    initEnv,
    sassModulesAndMixins,
    stylesDir,
} from "./rollup.extras.mjs";
import { ocPackageAliases } from "./oc-package-aliases.mjs";
import { handleDevelopmentServiceWorkerRequest } from "./devServiceWorkerCleanup";
import { publicKeyBuildPlugin } from "./publicKeyBuild.mjs";
import { resolveLocalDevAllowedHost } from "./devAllowedHost.mjs";
import { resolveDevHmrConfig } from "./devHmr";
import { resolveDevPort } from "./devPort";
import {
    createTransformersWebGpuDevRuntimeVersion,
    TRANSFORMERS_WEBGPU_DEV_RUNTIME_VERSION_META,
} from "./src/utils/transformersWebGpuDevRuntimeVersion";
import { patchQwen3Vl2bDecoderGraph } from "./transformersWebGpuDecoderGraph.mjs";
import {
    patchQwen3Vl2bDeepStackDecoderGraph,
    patchQwen3Vl2bDeepStackVisionGraph,
} from "./transformersWebGpuDeepStackGraph.mjs";
import {
    patchQwen3Vl2bGenerationGraph,
    QWEN3_VL_2B_GENERATION_BYTES,
} from "./transformersWebGpuQwenGenerationGraph.mjs";
import {
    patchQwen3Vl2bVisionGeometryGraph,
    QWEN3_VL_2B_VISION_GEOMETRY_BYTES,
} from "./transformersWebGpuQwenVisionGraph.mjs";
// Static imports let Vite track and reload the complete build-helper dependency closure.
import { transformersWebGpuSequentialSessionsPlugin } from "./transformersWebGpuSequentialSessions.mjs";
import { transformersWebGpuOrtSessionConfigPlugin } from "./transformersWebGpuOrtSessionConfig.mjs";
import {
    LOCAL_REPLICA_IMAGE_ROUTE_PREFIX,
    MAX_LOCAL_REPLICA_IMAGE_BYTES,
    parseLocalReplicaImagePath,
} from "./localReplicaImageProxy";
import { transformersWebGpuFeatureEnabled } from "./transformersWebGpuFeatureFlag.mjs";
import {
    localAndroidAssetLinksPlugin,
    resolveLocalAndroidAssetLinksConfig,
} from "./localAndroidAssetLinks";

const version = `1000.0.${Date.now()}`;
const inlineScripts = [`window.OC_WEBSITE_VERSION = "${version}";`];
process.env.OC_WEBSITE_VERSION = version;
const devTransformersWebGpuRuntimeVersion = createTransformersWebGpuDevRuntimeVersion(version);

initEnv();

const isNativeIos = process.env.OC_APP_TYPE === "ios";
const isNativeAndroid = process.env.OC_APP_TYPE === "android";
const isNativeApp = isNativeIos || isNativeAndroid;
// Dev server port — shared by the listener and HMR client. Card-integration QC uses 5003 while the
// ordinary web/native scripts retain 5001, so both must derive from the same explicit setting.
const port = resolveDevPort(process.env.OC_DEV_PORT);
const devAllowedHost = resolveLocalDevAllowedHost(
    process.env.OC_BUILD_ENV,
    process.env.OC_DFX_NETWORK,
    process.env.OC_DEV_ALLOWED_HOST,
);
const devHmr = resolveDevHmrConfig(port, devAllowedHost);
const localAndroidAssetLinks = resolveLocalAndroidAssetLinksConfig(process.env);

// The former workspace sub-packages (@shared/@client/@agent/@worker) resolve
// directly from their TypeScript source via `ocPackageAliases` — see
// ./oc-package-aliases.mjs, the single source shared with build-workers.mjs.

// Directory (gitignored, under node_modules) where the dev web worker bundle is
// emitted before being served at /worker.js.
const workerBuildDir = path.resolve(__dirname, "node_modules/.oc-worker");
const workerEntry = path.resolve(__dirname, "../openchat-worker/src/worker.ts");
const transformersWebGpuWorkerEntry = path.resolve(
    __dirname,
    "./src/workers/transformersWebGpuInference.worker.ts",
);
const transformersWebGpuOrtJspiAlias = {
    find: "onnxruntime-web/webgpu",
    replacement: "onnxruntime-web/jspi",
};
const transformersWebGpuSpikeEnabled = transformersWebGpuFeatureEnabled(process.env);
const workerTargets = [
    { entry: workerEntry, fileName: "worker.js", sequentialWebGpuSessions: false },
    {
        entry: path.resolve(__dirname, "../openchat-worker/src/transcodeWorker.ts"),
        fileName: "transcode_worker.js",
        sequentialWebGpuSessions: false,
    },
    ...(transformersWebGpuSpikeEnabled
        ? [
              {
                  entry: transformersWebGpuWorkerEntry,
                  fileName: "transformers_webgpu_worker.js",
                  sequentialWebGpuSessions: true,
              },
          ]
        : []),
] as const;

const LOCAL_EXTRACTOR_ASSET_PREFIX = "/assets/local-extractor/v7.0.0/";
const localExtractorAssets = new Map<string, { path: string; contentType: string }>([
    [
        "worker.min.js",
        {
            path: path.resolve(__dirname, "../node_modules/tesseract.js/dist/worker.min.js"),
            contentType: "text/javascript; charset=utf-8",
        },
    ],
    [
        "worker.min.js.LICENSE.txt",
        {
            path: path.resolve(
                __dirname,
                "../node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt",
            ),
            contentType: "text/plain; charset=utf-8",
        },
    ],
    ...[
        "tesseract-core-relaxedsimd-lstm.wasm.js",
        "tesseract-core-simd-lstm.wasm.js",
        "tesseract-core-lstm.wasm.js",
    ].map((fileName): [string, { path: string; contentType: string }] => [
        `core/${fileName}`,
        {
            path: path.resolve(__dirname, `../node_modules/tesseract.js-core/${fileName}`),
            contentType: "text/javascript; charset=utf-8",
        },
    ]),
    [
        "lang/eng.traineddata.gz",
        {
            path: path.resolve(
                __dirname,
                "../node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
            ),
            contentType: "application/gzip",
        },
    ],
    [
        "lang/ara.traineddata.gz",
        {
            path: path.resolve(
                __dirname,
                "../node_modules/@tesseract.js-data/ara/4.0.0_best_int/ara.traineddata.gz",
            ),
            contentType: "application/gzip",
        },
    ],
]);

const TRANSFORMERS_WEBGPU_ASSET_PREFIX =
    "/assets/transformers-webgpu/ort-1.29.0-dev.20260723-1b1e1db7bc/";
const transformersWebGpuAssets = new Map<string, { path: string; contentType: string }>([
    [
        "ort-wasm-simd-threaded.jspi.mjs",
        {
            path: path.resolve(
                __dirname,
                "../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jspi.mjs",
            ),
            contentType: "text/javascript; charset=utf-8",
        },
    ],
    [
        "ort-wasm-simd-threaded.jspi.wasm",
        {
            path: path.resolve(
                __dirname,
                "../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jspi.wasm",
            ),
            contentType: "application/wasm",
        },
    ],
]);

const QWEN3_VL_2B_MODEL_ROUTE_PREFIX =
    "/hf-model/onnx-community/Qwen3-VL-2B-Instruct-ONNX/resolve/3e4136ea66ae6e07c110e64fe07da2e029517ab5/onnx/";
type Qwen3Vl2bModelOverride = {
    path: string;
    bytes: number;
    transform?: (bytes: Uint8Array) => Uint8Array;
};
const qwen3Vl2bModelOverrides = new Map<string, Qwen3Vl2bModelOverride>([
    [
        "decoder_model_merged_q4.onnx",
        {
            path: path.resolve(
                __dirname,
                "./model-overrides/qwen3vl2b/onnx/decoder_model_merged_q4.onnx",
            ),
            bytes: QWEN3_VL_2B_GENERATION_BYTES,
            transform: (bytes) =>
                patchQwen3Vl2bGenerationGraph(
                    patchQwen3Vl2bDeepStackDecoderGraph(patchQwen3Vl2bDecoderGraph(bytes)),
                    { scope: "generation-only" },
                ),
        },
    ],
    [
        "vision_encoder_q4.onnx",
        {
            path: path.resolve(
                __dirname,
                "./model-overrides/qwen3vl2b/onnx/vision_encoder_q4.onnx",
            ),
            bytes: QWEN3_VL_2B_VISION_GEOMETRY_BYTES,
            transform: (bytes) =>
                patchQwen3Vl2bVisionGeometryGraph(patchQwen3Vl2bDeepStackVisionGraph(bytes)),
        },
    ],
]);

function developmentServiceWorkerCleanupPlugin(): Plugin {
    return {
        name: "development-service-worker-cleanup",
        configureServer(server) {
            server.middlewares.use(handleDevelopmentServiceWorkerRequest);
        },
    };
}

/**
 * Stream local StorageBucket images through the Vite origin used by the phone.
 *
 * Chat events correctly contain `http://<canister>.raw.localhost:8080/...` in a local deployment,
 * but `localhost` is the phone when OpenChat is opened through Tailscale HTTPS. Routing one tightly
 * validated public-image path through Vite avoids mixed content and avoids copying the whole image
 * through the OpenChat background worker. The upstream is always the configured local replica;
 * neither the host nor the path can be supplied arbitrarily by the browser.
 */
function localReplicaImageProxyPlugin(): Plugin {
    const enabled =
        !isNativeApp &&
        process.env.OC_BUILD_ENV === "development" &&
        process.env.OC_DFX_NETWORK === "local";
    const upstream = new URL(`http://${dfxJson.networks.local.bind}`);
    const upstreamPort = upstream.port || "80";

    return {
        name: "local-replica-image-proxy",
        // vite-plugin-html also runs as `pre` and installs its own history fallback. Keep this
        // plugin ahead of it (matching the plugins array order below), otherwise navigation-style
        // Accept headers are rewritten to /index.html before the image route can be handled.
        enforce: "pre",
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const requestUrl = new URL(req.url ?? "/", "http://localhost");
                if (!requestUrl.pathname.startsWith(`${LOCAL_REPLICA_IMAGE_ROUTE_PREFIX}/`)) {
                    next();
                    return;
                }
                if (!enabled) {
                    res.statusCode = 404;
                    res.end("not found");
                    return;
                }
                if (req.method !== "GET" && req.method !== "HEAD") {
                    res.statusCode = 405;
                    res.setHeader("Allow", "GET, HEAD");
                    res.end("method not allowed");
                    return;
                }
                if (requestUrl.search !== "") {
                    res.statusCode = 400;
                    res.end("invalid image route");
                    return;
                }

                const route = parseLocalReplicaImagePath(requestUrl.pathname);
                if (route === undefined) {
                    res.statusCode = 400;
                    res.end("invalid image route");
                    return;
                }

                const headers: http.OutgoingHttpHeaders = {
                    Host: `${route.canisterId}.raw.localhost:${upstreamPort}`,
                    // This endpoint is image-only, so do not let browser navigation content
                    // negotiation alter the upstream response.
                    Accept: "image/*",
                };
                if (typeof req.headers.range === "string") {
                    headers.Range = req.headers.range;
                }

                const upstreamRequest = http.request(
                    {
                        protocol: upstream.protocol,
                        hostname: upstream.hostname,
                        port: upstreamPort,
                        method: req.method,
                        path: route.upstreamPath,
                        headers,
                    },
                    (upstreamResponse) => {
                        const status = upstreamResponse.statusCode ?? 502;
                        const contentType = upstreamResponse.headers["content-type"];
                        const contentLength = upstreamResponse.headers["content-length"];
                        const contentRange = upstreamResponse.headers["content-range"];

                        if (status === 200 || status === 206) {
                            const mimeType = contentType?.split(";", 1)[0].trim().toLowerCase();
                            const totalText =
                                status === 206
                                    ? /^bytes \d+-\d+\/(\d+)$/.exec(contentRange ?? "")?.[1]
                                    : contentLength;
                            const total = totalText === undefined ? NaN : Number(totalText);
                            if (!mimeType?.startsWith("image/")) {
                                upstreamResponse.resume();
                                res.statusCode = 502;
                                res.end("replica returned non-image content");
                                return;
                            }
                            if (
                                !Number.isSafeInteger(total) ||
                                total < 1 ||
                                total > MAX_LOCAL_REPLICA_IMAGE_BYTES
                            ) {
                                upstreamResponse.resume();
                                res.statusCode = 413;
                                res.end("image exceeds local display limit");
                                return;
                            }
                        }

                        res.statusCode = status;
                        for (const name of [
                            "content-type",
                            "content-length",
                            "content-range",
                            "accept-ranges",
                            "etag",
                            "last-modified",
                        ] as const) {
                            const value = upstreamResponse.headers[name];
                            if (value !== undefined) res.setHeader(name, value);
                        }
                        // This route reflects mutable local replica state across development runs.
                        res.setHeader("Cache-Control", "no-store");
                        res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
                        res.setHeader("X-Content-Type-Options", "nosniff");

                        if (req.method === "HEAD") {
                            upstreamResponse.resume();
                            res.end();
                        } else {
                            upstreamResponse.pipe(res);
                        }
                    },
                );
                upstreamRequest.on("error", () => {
                    if (!res.headersSent) {
                        res.statusCode = 502;
                        res.end("local replica unavailable");
                    } else {
                        res.destroy();
                    }
                });
                req.on("aborted", () => upstreamRequest.destroy());
                upstreamRequest.end();
            });
        },
    };
}

// Tesseract's worker, selected WASM core and Arabic/English language packs are loaded lazily by URL
// rather than bundled into the initial OpenChat graph. Serve the exact pinned npm artifacts
// same-origin in development; the production Rollup build copies the same files to the same paths.
function localExtractorAssetsPlugin(): Plugin {
    return {
        name: "local-extractor-assets",
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
                if (!pathname.startsWith(LOCAL_EXTRACTOR_ASSET_PREFIX)) {
                    next();
                    return;
                }
                const relative = pathname.slice(LOCAL_EXTRACTOR_ASSET_PREFIX.length);
                const asset = localExtractorAssets.get(relative);
                if (asset === undefined || !fs.existsSync(asset.path)) {
                    res.statusCode = 404;
                    res.end("not found");
                    return;
                }
                if (req.method !== "GET" && req.method !== "HEAD") {
                    res.statusCode = 405;
                    res.setHeader("Allow", "GET, HEAD");
                    res.end("method not allowed");
                    return;
                }
                res.setHeader("Content-Type", asset.contentType);
                res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
                res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
                res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
                res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
                if (req.method === "HEAD") {
                    res.setHeader("Content-Length", fs.statSync(asset.path).size);
                    res.end();
                    return;
                }
                fs.createReadStream(asset.path).pipe(res);
            });
        },
    };
}

function transformersWebGpuAssetsPlugin(): Plugin {
    return {
        name: "transformers-webgpu-assets",
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
                if (!pathname.startsWith(TRANSFORMERS_WEBGPU_ASSET_PREFIX)) {
                    next();
                    return;
                }
                const relative = pathname.slice(TRANSFORMERS_WEBGPU_ASSET_PREFIX.length);
                const asset = transformersWebGpuAssets.get(relative);
                if (asset === undefined || !fs.existsSync(asset.path)) {
                    res.statusCode = 404;
                    res.end("not found");
                    return;
                }
                if (req.method !== "GET" && req.method !== "HEAD") {
                    res.statusCode = 405;
                    res.setHeader("Allow", "GET, HEAD");
                    res.end("method not allowed");
                    return;
                }
                res.setHeader("Content-Type", asset.contentType);
                res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
                res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
                res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
                res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
                if (req.method === "HEAD") {
                    res.setHeader("Content-Length", fs.statSync(asset.path).size);
                    res.end();
                    return;
                }
                fs.createReadStream(asset.path).pipe(res);
            });
        },
    };
}

/** Serve only the two audited Adreno graph rewrites ahead of the Hugging Face proxy.
 *
 * The checked-in decoder graph is also deterministically extended with a tied-embedding path. Its
 * source and encoded output hashes are fail-closed in `transformersWebGpuDecoderGraph.mjs`.
 *
 * The large external-data files remain byte-identical to the pinned Hub revision and stream through
 * `/hf-model`. Keeping the replacement route under that same immutable URL means Cache API entries
 * are origin-scoped correctly for both loopback and a private HTTPS development hostname. */
function qwen3Vl2bModelOverridesPlugin(): Plugin {
    const patchedGraphs = new Map<string, Uint8Array>();
    return {
        name: "qwen3-vl-2b-adreno-model-overrides",
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                if (!transformersWebGpuSpikeEnabled) {
                    next();
                    return;
                }
                const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
                if (!pathname.startsWith(QWEN3_VL_2B_MODEL_ROUTE_PREFIX)) {
                    next();
                    return;
                }
                const relative = pathname.slice(QWEN3_VL_2B_MODEL_ROUTE_PREFIX.length);
                const asset = qwen3Vl2bModelOverrides.get(relative);
                if (asset === undefined) {
                    next();
                    return;
                }
                if (!fs.existsSync(asset.path)) {
                    res.statusCode = 503;
                    res.end("pinned model override missing");
                    return;
                }
                if (req.method !== "GET" && req.method !== "HEAD") {
                    res.statusCode = 405;
                    res.setHeader("Allow", "GET, HEAD");
                    res.end("method not allowed");
                    return;
                }
                let transformed: Uint8Array | undefined;
                if (asset.transform !== undefined) {
                    try {
                        transformed = patchedGraphs.get(relative);
                        if (transformed === undefined) {
                            transformed = asset.transform(fs.readFileSync(asset.path));
                            if (transformed.byteLength !== asset.bytes) {
                                throw new Error("The deterministic Qwen graph byte count changed.");
                            }
                            patchedGraphs.set(relative, transformed);
                        }
                    } catch (error) {
                        server.config.logger.error(`[qwen-model-graph] ${String(error)}`);
                        res.statusCode = 503;
                        res.end("pinned model transform failed");
                        return;
                    }
                }
                const bytes = transformed?.byteLength ?? fs.statSync(asset.path).size;
                res.setHeader("Content-Type", "application/octet-stream");
                res.setHeader("Content-Length", String(bytes));
                res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
                res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
                if (req.method === "HEAD") {
                    res.end();
                    return;
                }
                if (transformed !== undefined) {
                    res.end(transformed);
                    return;
                }
                fs.createReadStream(asset.path).pipe(res);
            });
        },
    };
}
// Builds the web worker from TypeScript source — reusing the sub-package
// aliases so it pulls agent/shared from source too — and serves it at
// /worker.js, rebuilding and triggering a full reload when worker/agent/shared
// source changes. Replaces serving the Turbo-compiled
// openchat-worker/lib/worker.js together with the chokidar poll that waited for
// those lib files to appear.
function ocWorkerPlugin(): Plugin {
    async function buildWorker() {
        for (const target of workerTargets) {
            await build({
                configFile: false,
                logLevel: "warn",
                resolve: {
                    // Match production: only the all-WebGPU model worker replaces Transformers.js'
                    // asyncify ORT import with the JSPI entry point.
                    alias:
                        target.sequentialWebGpuSessions === true
                            ? [transformersWebGpuOrtJspiAlias, ...ocPackageAliases]
                            : ocPackageAliases,
                    // Match production: never embed ORT's WASM payload into the JS worker.
                    conditions: ["onnxruntime-web-use-extern-wasm"],
                },
                define: { "process.env.NODE_ENV": JSON.stringify("development") },
                plugins:
                    target.sequentialWebGpuSessions === true
                        ? [
                              transformersWebGpuSequentialSessionsPlugin(),
                              // The qualified JS helper infers its literal enforce value as string.
                              transformersWebGpuOrtSessionConfigPlugin() as Plugin,
                          ]
                        : [],
                build: {
                    outDir: workerBuildDir,
                    emptyOutDir: false,
                    target: "es2020",
                    minify: false,
                    sourcemap: true,
                    lib: {
                        entry: target.entry,
                        formats: ["es"],
                        fileName: () => target.fileName,
                    },
                },
            });
        }
        // The model worker is immutable once selected. Rotate only after every target has rebuilt
        // successfully so the ensuing full reload cannot restore an older worker under the same URL.
        devTransformersWebGpuRuntimeVersion.rotate();
    }

    return {
        name: "oc-worker",
        transformIndexHtml() {
            if (!transformersWebGpuSpikeEnabled) return [];
            return [
                {
                    tag: "meta",
                    attrs: {
                        name: TRANSFORMERS_WEBGPU_DEV_RUNTIME_VERSION_META,
                        content: devTransformersWebGpuRuntimeVersion.current(),
                    },
                    injectTo: "head-prepend",
                },
            ];
        },
        async configureServer(server) {
            await buildWorker();

            // Serve the built workers (and their sourcemaps) regardless of the
            // ?v= cache-busting query string the client appends.
            server.middlewares.use((req, res, next) => {
                const fileName = path.basename((req.url ?? "").split("?")[0]);
                const filePath = path.join(workerBuildDir, fileName);
                const workerFiles = workerTargets.flatMap(({ fileName }) => [
                    fileName,
                    `${fileName}.map`,
                ]);
                if (workerFiles.includes(fileName) && fs.existsSync(filePath)) {
                    // This middleware writes the response itself, so `server.headers` does not
                    // apply. Preserve cross-origin isolation for the browser inference worker.
                    res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
                    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
                    res.setHeader(
                        "Content-Type",
                        fileName.endsWith(".map") ? "application/json" : "text/javascript",
                    );
                    if (fileName === "transformers_webgpu_worker.js") {
                        // Its request URL includes the current website version. Model Manager
                        // consumes that exact response before enabling inference, so later Worker
                        // construction must reuse the browser cache rather than download on Run.
                        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
                    }
                    res.setHeader("Content-Length", String(fs.statSync(filePath).size));
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
                "./src/workers/transformersWebGpuInference.worker.ts",
                "./src/utils/transformersWebGpuDeviceRetirement.ts",
                "./src/utils/transformersWebGpuProtocol.ts",
                "./src/utils/transformersWebGpuProcessorConfig.ts",
                "./src/utils/gemma4WebGpuEmbedding.ts",
                "./src/utils/imageDimensions.ts",
                "./src/utils/transformersWebGpuAudio.ts",
                "./src/utils/transformersWebGpuImageLayout.ts",
                "./src/utils/transformersWebGpuQwenContext.ts",
                "./src/utils/transformersWebGpuCompletion.ts",
                "./src/utils/transformersWebGpuOrtDiagnostics.ts",
                "./src/utils/transformersWebGpuPipelineCompilation.ts",
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
        "import.meta.env.OC_DEV_ALLOWED_HOST":
            devAllowedHost === undefined ? "undefined" : JSON.stringify(devAllowedHost),
        "import.meta.env.OC_WEBSITE_VERSION": JSON.stringify(version),
    },
    // Prebundling can otherwise give svelte-material-icons a private Svelte runtime whose DOM
    // getters are still uninitialized when the first mobile icon renders during startup. The
    // local component-lib contains .svelte.ts rune modules; those must use Vite's normal
    // TypeScript-then-Svelte transform pipeline rather than Svelte's raw dependency prebundler.
    optimizeDeps: {
        exclude: ["component-lib", "svelte-material-icons"],
    },
    server: {
        // Mobile QC terminates HTTPS at a local proxy and forwards one configured hostname. Keep
        // this explicit; accepting arbitrary hosts would weaken Vite's DNS-rebinding protection.
        allowedHosts: ["host.docker.internal", ...(devAllowedHost ? [devAllowedHost] : [])],
        host: true,
        cors: true,
        port,
        strictPort: true,
        // An HTTPS page cannot connect to a ws:// HMR endpoint. When the validated mobile-QC host
        // is configured, point the client at the TLS-terminating proxy while retaining Vite's
        // internal listener port. Direct localhost development keeps the ordinary ws:// endpoint.
        hmr: devHmr,
        proxy: isNativeApp
            ? undefined
            : {
                  // Keep immutable Hugging Face model fetches same-origin under the local meta CSP
                  // and COEP policy. followRedirects streams the Hub's signed LFS/Xet response
                  // through Vite; Transformers.js caches it under the revision-keyed local URL.
                  ...(transformersWebGpuSpikeEnabled
                      ? {
                            "/hf-model": {
                                target: "https://huggingface.co",
                                changeOrigin: true,
                                followRedirects: true,
                                rewrite: (requestPath: string) =>
                                    requestPath.replace(/^\/hf-model/, ""),
                            },
                        }
                      : {}),
                  // A phone reaches Vite through a private HTTPS hostname. Do not forward that
                  // external Host header to the local IC HTTP gateway: it rejects unknown domains
                  // before handling even the replica status endpoint. Rewriting Host to the
                  // configured local target keeps both authenticated bootstrap and canister calls
                  // routable without inventing a canister header.
                  "/api": {
                      target: `http://${dfxJson.networks.local.bind}`,
                      changeOrigin: true,
                      // Tailscale Serve supplies the original HTTPS hostname separately. The IC
                      // gateway gives X-Forwarded-Host precedence over the rewritten Host header,
                      // so retaining it still produces `unknown_domain` on /api/v2/status.
                      configure(proxy) {
                          proxy.on("proxyReq", (proxyRequest) => {
                              proxyRequest.removeHeader("x-forwarded-host");
                              proxyRequest.removeHeader("x-forwarded-port");
                              proxyRequest.removeHeader("forwarded");
                          });
                      },
                  },
              },
        headers: {
            "Cache-Control": "no-store",
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "credentialless",
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
        localAndroidAssetLinksPlugin(
            process.env.OC_BUILD_ENV === "development" &&
                process.env.OC_DFX_NETWORK === "local" &&
                !isNativeApp,
            localAndroidAssetLinks,
        ),
        svelte() as PluginOption,
        replace({
            "process.env": "import.meta.env",
            preventAssignment: true,
        }) as PluginOption,
        developmentServiceWorkerCleanupPlugin(),
        localReplicaImageProxyPlugin(),
        ocWorkerPlugin(),
        localExtractorAssetsPlugin(),
        transformersWebGpuAssetsPlugin(),
        qwen3Vl2bModelOverridesPlugin(),
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
        publicKeyBuildPlugin({
            network: process.env.OC_DFX_NETWORK ?? "local",
            canister: process.env.OC_USER_INDEX_CANISTER,
        }),
    ],
    resolve: {
        alias: [
            ...ocPackageAliases,
            // The Tauri plugin's guest JS is resolved from source (guest-js/)
            // rather than its built dist-js output, like the sub-packages above.
            {
                find: /^tauri-plugin-oc-api\/(.*)$/,
                replacement: path.join(
                    path.resolve(__dirname, "../tauri-plugin-oc/guest-js"),
                    "$1",
                ),
            },
            {
                find: /^tauri-plugin-oc-api$/,
                replacement: path.resolve(__dirname, "../tauri-plugin-oc/guest-js/index.ts"),
            },
            { find: "@dfinity/agent", replacement: "@icp-sdk/core/agent" },
            { find: "@dfinity/auth-client", replacement: "@icp-sdk/auth/client" },
            // Keep dev in step with the prod build (see rollup.config.mjs).
            {
                find: "@formatjs/intl-getcanonicallocales",
                replacement: path.resolve(__dirname, "./src/utils/intlGetCanonicalLocales.ts"),
            },
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
                // Support both Sass APIs used by the Vite/Svelte toolchain.
                loadPaths: [stylesDir],
                includePaths: [stylesDir],
            },
        },
    },
});
