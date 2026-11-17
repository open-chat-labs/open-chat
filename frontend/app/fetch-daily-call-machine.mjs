// Puts Daily's bundles, the code a Daily call object runs (its call machine, and the audio processor
// it loads when it needs one), in public/daily/<version>/ so the app serves them from its own origin
// (#10124). Daily otherwise loads it from c.daily.co at call time and evals
// it, which the CSP blocks; and serving a pinned copy means the code that runs in OpenChat's page
// can only change when daily-call-machine.json does. The download must match the pinned sha256,
// or the build stops.
//
// To upgrade daily-js: set daily-call-machine.json's version to the new one and each bundle's sha256
// to the new file's (shasum -a 256 of the file at `source` below), after checking what changed.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pin = JSON.parse(readFileSync(path.join(__dirname, "daily-call-machine.json"), "utf8"));
// daily-js loads every bundle from this one folder (its bundlePathOverride)
const dir = path.join(__dirname, "public", "daily", pin.version);
const source = `https://c.daily.co/call-machine/versioned/${pin.version}/static`;

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

for (const [name, expected] of Object.entries(pin.bundles)) {
    const file = path.join(dir, name);
    if (existsSync(file) && sha256(readFileSync(file)) === expected) continue;

    const url = `${source}/${name}`;
    const response = await fetch(url);
    if (!response.ok) {
        console.error(`Daily bundles: ${url} answered ${response.status}`);
        process.exit(1);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const actual = sha256(bytes);
    if (actual !== expected) {
        console.error(
            `Daily bundles: ${url} has sha256 ${actual}, not the pinned ${expected}. ` +
                "Check what changed before updating daily-call-machine.json.",
        );
        process.exit(1);
    }
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, bytes);
    console.log(`Daily bundle ${pin.version}/${name} fetched and verified`);
}
