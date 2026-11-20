// The reach report (#10554, PRD #10550 invariant 1): which `OpenChat` members the old UI trees can
// call that the new ones can't. Each tree is walked from its App.svelte through its imports (the
// app's tsconfig aliases included; @client and npm packages are where the walk stops), and every
// `client.<member>` in a file it reaches counts. A member the old trees reach and the new ones don't
// is a gap until differences.mjs acknowledges it.
//
// It's the switchover gate, so it exits non-zero while any gap is unacknowledged. Matching is
// textual: a false gap is acknowledged as "not a gap: ...".
//
//   npm run parity:reach

import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const TREES = {
    v1: "app/src/components/App.svelte",
    v2: "app/src/components_mobile/App.svelte",
    "v3 desktop": "app/src/web/App.svelte",
    "v3 mobile": "app/src/native/App.svelte",
};
export const OLD = ["v1", "v2"];
export const NEW = ["v3 desktop", "v3 mobile"];

// UI code lives here; anything else (the client, the agent, npm) ends the walk
const UI_ROOTS = ["app/src", "openchat-ui", "component-lib"];
const CODE = /\.(ts|js|mjs|svelte)$/;
const EXTENSIONS = ["", ".ts", ".svelte", ".js", ".mjs", "/index.ts", "/index.js"];

/** The public members of the class `className` in `source` (no `#private`, `private` or `protected`). */
export function classMembers(source, className) {
    const file = ts.createSourceFile("x.ts", source, ts.ScriptTarget.Latest, true);
    const members = new Set();
    file.forEachChild(function visit(node) {
        if (ts.isClassDeclaration(node) && node.name?.text === className) {
            for (const m of node.members) {
                if (m.name === undefined || ts.isPrivateIdentifier(m.name)) continue;
                if (ts.isConstructorDeclaration(m)) continue;
                const hidden = ts
                    .getModifiers(m)
                    ?.some(
                        (mod) =>
                            mod.kind === ts.SyntaxKind.PrivateKeyword ||
                            mod.kind === ts.SyntaxKind.ProtectedKeyword,
                    );
                if (!hidden) members.add(m.name.getText(file));
            }
        } else {
            node.forEachChild(visit);
        }
    });
    return members;
}

/** The `client.<member>` uses in `text`, as member → first line number. */
export function clientCalls(text, members) {
    const found = new Map();
    const lines = text.split("\n");
    lines.forEach((line, i) => {
        for (const m of line.matchAll(/client\??\.\s*([A-Za-z_$][\w$]*)/g)) {
            if (members.has(m[1]) && !found.has(m[1])) found.set(m[1], i + 1);
        }
    });
    return found;
}

/** The module specifiers `text` imports or re-exports, static and dynamic. */
export function importsOf(text) {
    return [...text.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*["']([^"'\n]+)["']/g)].map((m) => m[1]);
}

/** Path aliases from a tsconfig's `compilerOptions.paths`, resolved against its directory. */
export function aliasesOf(tsconfigPath) {
    const { config } = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
    const dir = path.dirname(tsconfigPath);
    const paths = config?.compilerOptions?.paths ?? {};
    return Object.entries(paths).map(([key, [target]]) =>
        key.endsWith("/*")
            ? { prefix: key.slice(0, -1), to: path.resolve(dir, target.slice(0, -1)) }
            : { exact: key, to: path.resolve(dir, target) },
    );
}

function isFile(p) {
    return existsSync(p) && statSync(p).isFile();
}

/** Where `spec`, imported from `from`, resolves to on disk, or undefined (a package, or not code). */
export function resolveImport(spec, from, aliases) {
    let base;
    if (spec.startsWith(".")) {
        base = path.resolve(path.dirname(from), spec);
    } else {
        const alias = aliases.find((a) => (a.exact ? spec === a.exact : spec.startsWith(a.prefix)));
        if (alias === undefined) return undefined;
        base = alias.exact ? alias.to : path.join(alias.to, spec.slice(alias.prefix.length));
    }
    for (const ext of EXTENSIONS) {
        if (isFile(base + ext) && CODE.test(base + ext)) return base + ext;
    }
    return undefined;
}

/**
 * Every file reachable from `entry` within `roots`, with the members each one calls on the client.
 * Returns member → the first place it's called (path relative to `base`, and line).
 */
export function reach(entry, { members, aliases, roots, base }) {
    const seen = new Set();
    const calls = new Map();
    const queue = [entry];
    while (queue.length > 0) {
        const file = queue.pop();
        if (seen.has(file)) continue;
        seen.add(file);
        const text = readFileSync(file, "utf8");
        for (const [member, line] of clientCalls(text, members)) {
            if (!calls.has(member)) calls.set(member, `${path.relative(base, file)}:${line}`);
        }
        for (const spec of importsOf(text)) {
            const next = resolveImport(spec, file, aliases);
            if (next !== undefined && roots.some((r) => next.startsWith(r + path.sep))) {
                queue.push(next);
            }
        }
    }
    return { files: seen.size, calls };
}

/** Members the old trees reach and the new ones don't, split into acknowledged and gaps. */
export function reachReport(byTree, differences) {
    const newReach = new Set(NEW.flatMap((t) => [...byTree[t].calls.keys()]));
    const oldOnly = new Map();
    for (const t of OLD) {
        for (const [member, at] of byTree[t].calls) {
            if (newReach.has(member)) continue;
            const entry = oldOnly.get(member) ?? { trees: [], at };
            entry.trees.push(t);
            oldOnly.set(member, entry);
        }
    }
    const gaps = [...oldOnly].filter(([m]) => differences[m] === undefined);
    const acknowledged = [...oldOnly].filter(([m]) => differences[m] !== undefined);
    const unused = Object.keys(differences).filter((m) => !oldOnly.has(m));
    return { gaps, acknowledged, unused };
}

function print(byTree, report, differences, total) {
    const counts = Object.entries(byTree)
        .map(([t, r]) => `${t} ${r.calls.size} (${r.files} files)`)
        .join(", ");
    console.log(`OpenChat members reached, of ${total}: ${counts}\n`);

    const groups = [
        ["v1 and v2", (trees) => trees.length === 2],
        ["v1 only", (trees) => trees.length === 1 && trees[0] === "v1"],
        ["v2 only", (trees) => trees.length === 1 && trees[0] === "v2"],
    ];
    console.log(`Gaps: ${report.gaps.length} (old trees reach them, new trees don't)`);
    for (const [label, match] of groups) {
        const rows = report.gaps
            .filter(([, e]) => match(e.trees))
            .sort(([a], [b]) => a.localeCompare(b));
        if (rows.length === 0) continue;
        console.log(`\n  ${label} (${rows.length}):`);
        for (const [m, e] of rows) console.log(`    ${m.padEnd(44)} ${e.at}`);
    }
    if (report.acknowledged.length > 0) {
        console.log(`\nAcknowledged: ${report.acknowledged.length}`);
        for (const [m] of report.acknowledged.sort(([a], [b]) => a.localeCompare(b))) {
            const d = differences[m];
            console.log(`    ${m.padEnd(44)} ${d.reason} (${d.decided})`);
        }
    }
    if (report.unused.length > 0) {
        console.log(
            `\nAcknowledged but no longer a gap (can be removed): ${report.unused.join(", ")}`,
        );
    }
}

async function main() {
    const { differences } = await import("./differences.mjs");
    const members = classMembers(
        readFileSync(path.join(frontend, "openchat-client/src/openchat.ts"), "utf8"),
        "OpenChat",
    );
    const options = {
        members,
        aliases: aliasesOf(path.join(frontend, "app/tsconfig.json")),
        roots: UI_ROOTS.map((r) => path.join(frontend, r)),
        base: frontend,
    };
    const byTree = Object.fromEntries(
        Object.entries(TREES).map(([t, entry]) => [t, reach(path.join(frontend, entry), options)]),
    );
    const report = reachReport(byTree, differences);
    print(byTree, report, differences, members.size);
    process.exitCode = report.gaps.length > 0 ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    await main();
}
