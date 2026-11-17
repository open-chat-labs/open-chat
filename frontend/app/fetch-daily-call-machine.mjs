// Puts Daily's call machine, the code a Daily call object runs, in public/daily/ so the app serves
// it from its own origin (#10124). Daily otherwise loads it from c.daily.co at call time and evals
// it, which the CSP blocks; and serving a pinned copy means the code that runs in OpenChat's page
// can only change when daily-call-machine.json does. The download must match the pinned sha256,
// or the build stops.
//
// To upgrade daily-js: set daily-call-machine.json's version to the new one and its sha256 to the
// new bundle's (shasum -a 256 of the file at the URL below), after checking what changed.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pin = JSON.parse(readFileSync(path.join(__dirname, "daily-call-machine.json"), "utf8"));
const dir = path.join(__dirname, "public", "daily");
const file = path.join(dir, `call-machine-object-bundle-${pin.version}.js`);
const url = `https://c.daily.co/call-machine/versioned/${pin.version}/static/call-machine-object-bundle.js`;

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

if (existsSync(file) && sha256(readFileSync(file)) === pin.sha256) {
    process.exit(0);
}

const response = await fetch(url);
if (!response.ok) {
    console.error(`Daily call machine: ${url} answered ${response.status}`);
    process.exit(1);
}
const bytes = Buffer.from(await response.arrayBuffer());
const actual = sha256(bytes);
if (actual !== pin.sha256) {
    console.error(
        `Daily call machine: ${url} has sha256 ${actual}, not the pinned ${pin.sha256}. ` +
            "Check what changed before updating daily-call-machine.json.",
    );
    process.exit(1);
}
mkdirSync(dir, { recursive: true });
writeFileSync(file, bytes);
console.log(`Daily call machine ${pin.version} fetched and verified`);
