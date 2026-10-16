// Single source of truth for the @shared / @client / @agent / @worker →
// package-source aliases. Imported by the dev server + app builds (vite.config.ts,
// rollup.config.mjs), the worker build (build-workers.mjs) and the tests
// (frontend/vitest.config.ts) so they can't drift. A subpath import
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
    // The component library the new web UI (src/web) is built from. Its subpaths are
    // relative to the package root, as the library documents them and as an installed
    // package would resolve them (@openchat/ui/src/lib/...).
    { alias: "@openchat/ui", dir: "openchat-ui", entry: "src/lib/index.ts", subpathDir: "" },
];

// Vite/rollup `resolve.alias` entries mapping each alias (and its /subpath form)
// to the package's TypeScript source.
export const ocPackageAliases = ocPackages.flatMap(({ alias, dir, entry, subpathDir = "src" }) => {
    const root = path.resolve(__dirname, `../${dir}`);
    return [
        { find: new RegExp(`^${alias}/(.*)$`), replacement: path.join(root, subpathDir, "$1") },
        { find: new RegExp(`^${alias}$`), replacement: path.join(root, entry) },
    ];
});
