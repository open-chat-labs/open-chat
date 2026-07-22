// Builds the web worker and service worker from TypeScript source into their
// lib/ directories, which the production rollup build then copies into build/.
// Replaces the per-package rollup builds that Turbo used to run. Reuses the
// same source aliases as the dev server and the app build so the worker and
// service worker pull agent/shared from source.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { ocPackageAliases } from "./oc-package-aliases.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const targets = [
    {
        entry: "../openchat-worker/src/worker.ts",
        outDir: "../openchat-worker/lib",
        fileName: "worker.js",
    },
    {
        entry: "../openchat-service-worker/src/service_worker.ts",
        outDir: "../openchat-service-worker/lib",
        fileName: "service_worker.js",
    },
];

for (const target of targets) {
    await build({
        configFile: false,
        logLevel: "warn",
        // Without this Vite copies frontend/app/public into the lib/ outDir,
        // which the app build then sweeps into build/, clashing with dfx's
        // separate frontend/app/public asset source.
        publicDir: false,
        resolve: { alias: ocPackageAliases },
        define: { "process.env.NODE_ENV": JSON.stringify("production") },
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
