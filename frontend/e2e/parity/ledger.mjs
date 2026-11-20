// The capability ledger check (PRD #10550 invariant 2). Each file in ./ledger lists, for one area of
// the app, what the old UI can do there and, for each new tree, either the test that shows the tree
// does it too or why it doesn't:
//
//   { id, capability, legacy: ["file:line", …], desktop: <entry>, mobile: <entry> }
//
// where an entry is
//   - a test's title: the test must run on that tree's project (playwright test --list)
//   - { difference, decided }: the tree deliberately doesn't do it, and who decided
//   - { missing }: the tree doesn't do it yet. A gap, which is what the ledger is for
//   - { untested }: the tree does it, but no test shows it yet
//
// It's the switchover gate, so it exits non-zero while any row is missing, untested, or names a
// test that doesn't run on its tree.
//
//   npm run parity:ledger

import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const e2e = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The Playwright project each new tree's tests run in. */
export const PROJECTS = { desktop: "v3-desktop", mobile: "v3-mobile" };

/**
 * Checks `rows` against `testsByProject` (project → the titles of the tests that run in it).
 * Returns the rows' problems, each { id, tree, problem }, and the acknowledged differences.
 */
export function ledgerReport(rows, testsByProject) {
    const problems = [];
    const differences = [];
    const seen = new Set();
    for (const row of rows) {
        if (seen.has(row.id)) problems.push({ id: row.id, tree: "-", problem: "duplicate id" });
        seen.add(row.id);
        for (const [tree, project] of Object.entries(PROJECTS)) {
            const entry = row[tree];
            if (typeof entry === "string") {
                if (!testsByProject.get(project)?.has(entry)) {
                    problems.push({
                        id: row.id,
                        tree,
                        problem: `no test "${entry}" in ${project}`,
                    });
                }
            } else if (entry?.difference !== undefined && entry.decided !== undefined) {
                differences.push({ id: row.id, tree, ...entry });
            } else if (entry?.missing !== undefined) {
                problems.push({ id: row.id, tree, problem: `missing: ${entry.missing}` });
            } else if (entry?.untested !== undefined) {
                problems.push({ id: row.id, tree, problem: `untested: ${entry.untested}` });
            } else {
                problems.push({ id: row.id, tree, problem: "no test, difference or gap given" });
            }
        }
    }
    return { problems, differences };
}

/** The suite's tests, as project → titles, from `playwright test --list`. */
function listTests() {
    const out = execFileSync("npx", ["playwright", "test", "--list", "--reporter", "json"], {
        cwd: e2e,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
    });
    const tests = new Map();
    const walk = (suite) => {
        for (const spec of suite.specs ?? []) {
            for (const t of spec.tests) {
                if (!tests.has(t.projectName)) tests.set(t.projectName, new Set());
                tests.get(t.projectName).add(spec.title);
            }
        }
        for (const child of suite.suites ?? []) walk(child);
    };
    for (const suite of JSON.parse(out).suites) walk(suite);
    return tests;
}

async function main() {
    const dir = path.join(e2e, "parity/ledger");
    const files = readdirSync(dir).filter((f) => f.endsWith(".mjs"));
    const tests = listTests();
    let failed = false;
    for (const file of files) {
        const { rows } = await import(pathToFileURL(path.join(dir, file)).href);
        const { problems, differences } = ledgerReport(rows, tests);
        console.log(`${file}: ${rows.length} capabilities, ${problems.length} problems`);
        for (const p of problems) console.log(`    ${p.id.padEnd(28)} ${p.tree}  ${p.problem}`);
        for (const d of differences) {
            console.log(
                `    ${d.id.padEnd(28)} ${d.tree}  difference: ${d.difference} (${d.decided})`,
            );
        }
        failed ||= problems.length > 0;
    }
    process.exitCode = failed ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    await main();
}
