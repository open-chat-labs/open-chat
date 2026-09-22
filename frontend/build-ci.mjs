// Runs the npm scripts named on the command line concurrently (`node build-ci.mjs typecheck test`)
// and exits non-zero if any of them fails. Used by `npm run check:ci` to run the type checks and
// the tests at the same time, since they are independent.
//
// Each script's output is held back and printed as a block when it finishes, so the logs of the
// concurrent scripts don't interleave.
/* eslint-disable no-undef */
import { spawn } from "node:child_process";

const scripts = process.argv.slice(2);
if (scripts.length === 0) {
    console.error("usage: node build-ci.mjs <npm script> [<npm script> ...]");
    process.exit(2);
}

function run(script) {
    return new Promise((resolve) => {
        const chunks = [];
        const child = spawn("npm", ["run", script], { stdio: ["ignore", "pipe", "pipe"] });
        child.stdout.on("data", (chunk) => chunks.push(chunk));
        child.stderr.on("data", (chunk) => chunks.push(chunk));
        child.on("error", (err) => {
            chunks.push(Buffer.from(`${err}\n`));
            resolve({ script, code: 1, output: Buffer.concat(chunks).toString() });
        });
        child.on("close", (code) => {
            resolve({ script, code: code ?? 1, output: Buffer.concat(chunks).toString() });
        });
    });
}

console.log(`Running concurrently: ${scripts.join(", ")}`);
const results = await Promise.all(
    scripts.map((script) =>
        run(script).then((result) => {
            const status = result.code === 0 ? "passed" : `failed (exit code ${result.code})`;
            // ::group:: folds the block in the GitHub Actions log viewer
            console.log(`::group::${result.script} ${status}`);
            process.stdout.write(result.output);
            console.log("::endgroup::");
            return result;
        }),
    ),
);

const failed = results.filter((r) => r.code !== 0).map((r) => r.script);
if (failed.length > 0) {
    console.error(`Failed: ${failed.join(", ")}`);
    // Not process.exit(): that can drop buffered output when stdout is a pipe
    process.exitCode = 1;
} else {
    console.log(`Passed: ${scripts.join(", ")}`);
}
