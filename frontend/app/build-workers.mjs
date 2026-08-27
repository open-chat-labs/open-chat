// Builds the web worker and service worker from TypeScript source into their
// lib/ directories, which the production rollup build then copies into build/.
// Replaces the per-package rollup builds that Turbo used to run. Reuses the
// same source aliases as the dev server and the app build so the worker and
// service worker pull agent/shared from source.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { ocPackageAliases } from "./oc-package-aliases.mjs";
import { transformersWebGpuSequentialSessionsPlugin } from "./transformersWebGpuSequentialSessions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const transformersWebGpuOrtJspiAlias = {
    find: "onnxruntime-web/webgpu",
    replacement: "onnxruntime-web/jspi",
};
const transformersWebGpuSpikeEnabled =
    process.env.OC_BUILD_ENV === "development" &&
    process.env.OC_DFX_NETWORK === "local" &&
    process.env.OC_TRANSFORMERS_WEBGPU_IMAGE_SPIKE === "true";

const targets = [
    {
        entry: "../openchat-worker/src/worker.ts",
        outDir: "../openchat-worker/lib",
        fileName: "worker.js",
        sequentialWebGpuSessions: false,
    },
    {
        entry: "../openchat-service-worker/src/service_worker.ts",
        outDir: "../openchat-service-worker/lib",
        fileName: "service_worker.js",
        sequentialWebGpuSessions: false,
    },
    ...(transformersWebGpuSpikeEnabled
        ? [
              {
                  entry: "./src/workers/transformersWebGpuInference.worker.ts",
                  outDir: "../openchat-worker/lib",
                  fileName: "transformers_webgpu_worker.js",
                  sequentialWebGpuSessions: true,
              },
          ]
        : []),
];

for (const target of targets) {
    await build({
        configFile: false,
        logLevel: "warn",
        // Without this Vite copies frontend/app/public into the lib/ outDir,
        // which the app build then sweeps into build/, clashing with dfx's
        // separate frontend/app/public asset source.
        publicDir: false,
        resolve: {
            // Transformers.js imports ORT's asyncify WebGPU entry point. Only this model worker
            // selects the matching JSPI entry point; the app and all other workers keep their
            // existing runtime.
            alias:
                target.sequentialWebGpuSessions === true
                    ? [transformersWebGpuOrtJspiAlias, ...ocPackageAliases]
                    : ocPackageAliases,
            // ORT's default browser export inlines a ~24 MB WASM binary. Use its official
            // external-WASM condition; the worker points that build at our pinned same-origin file.
            conditions: ["onnxruntime-web-use-extern-wasm"],
        },
        define: { "process.env.NODE_ENV": JSON.stringify("production") },
        plugins:
            target.sequentialWebGpuSessions === true
                ? [transformersWebGpuSequentialSessionsPlugin()]
                : [],
        build: {
            outDir: path.resolve(__dirname, target.outDir),
            emptyOutDir: false,
            target: "es2020",
            minify: true,
            sourcemap: true,
            lib: {
                entry: path.resolve(__dirname, target.entry),
                formats: ["es"],
                fileName: () => target.fileName,
            },
        },
    });
}
