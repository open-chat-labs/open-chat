// Builds the web worker and service worker from TypeScript source into their
// lib/ directories, which the production rollup build then copies into build/.
// Replaces the per-package rollup builds that Turbo used to run. Reuses the
// same source aliases as the dev server and the app build so the worker and
// service worker pull agent/shared from source.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pkgAliases = [
    ["@shared", "openchat-shared", "src/index.ts"],
    ["@client", "openchat-client", "src/index.ts"],
    ["@agent", "openchat-agent", "src/index.ts"],
    ["@worker", "openchat-worker", "src/worker.ts"],
].flatMap(([alias, dir, entry]) => {
    const root = path.resolve(__dirname, "..", dir);
    return [
        { find: new RegExp(`^${alias}/(.*)$`), replacement: path.join(root, "src", "$1") },
        { find: new RegExp(`^${alias}$`), replacement: path.join(root, entry) },
    ];
});

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
        resolve: { alias: pkgAliases },
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
