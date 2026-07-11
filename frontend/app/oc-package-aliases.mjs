// Single source of truth for the @shared / @client / @agent / @worker →
// package-source aliases. Imported by the dev server + app build (vite.config.ts)
// and the worker build (build-workers.mjs) so they can't drift. A subpath import
// (e.g. @client/utils/time) maps to the package's src/ so the rest of the path is
// preserved; a bare import maps to the package's source entry point.
//
// The tsconfig `paths` copies (frontend/tsconfig.json and frontend/app/tsconfig.json)
// still have to be kept in sync by hand — TypeScript can't import this module — but
// the JS build consumers all read the mapping from here.
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ocPackages = [
    { alias: "@shared", dir: "openchat-shared", entry: "src/index.ts" },
    { alias: "@client", dir: "openchat-client", entry: "src/index.ts" },
    { alias: "@agent", dir: "openchat-agent", entry: "src/index.ts" },
    { alias: "@worker", dir: "openchat-worker", entry: "src/worker.ts" },
];

// Vite/rollup `resolve.alias` entries mapping each alias (and its /subpath form)
// to the package's TypeScript source.
export const ocPackageAliases = ocPackages.flatMap(({ alias, dir, entry }) => {
    const root = path.resolve(__dirname, `../${dir}`);
    return [
        { find: new RegExp(`^${alias}/(.*)$`), replacement: path.join(root, "src", "$1") },
        { find: new RegExp(`^${alias}$`), replacement: path.join(root, entry) },
    ];
});
