// The seed snapshot's users, handed out one per test. Tests run in several worker processes, so a
// user is claimed by creating a directory named after it: mkdir either makes it or fails because
// another test already has, never both.

import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * A pool user no other test in this run has claimed, `{ username, userId, passkey }`, or undefined
 * once they're all taken. `leasesDir` must exist; emptying it starts a new run.
 */
export function lease(poolDir, leasesDir) {
    const files = readdirSync(poolDir)
        .filter((f) => f.endsWith(".json"))
        .sort((a, b) => parseInt(a) - parseInt(b));
    for (const file of files) {
        try {
            mkdirSync(path.join(leasesDir, file));
        } catch (err) {
            if (err.code === "EEXIST") continue;
            throw err;
        }
        return JSON.parse(readFileSync(path.join(poolDir, file), "utf8"));
    }
    return undefined;
}
