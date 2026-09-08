// Regenerates src/utils/passkeyProviders.json from the community AAGUID list.
// Usage: npm run update:passkey-providers (from frontend/)

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE =
    "https://raw.githubusercontent.com/passkeydeveloper/passkey-authenticator-aaguids/main/combined_aaguid.json";
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const resp = await fetch(SOURCE);
if (!resp.ok) throw new Error(`Fetch failed: ${resp.status} ${resp.statusText}`);
const source = await resp.json();

const providers = {};
for (const [aaguid, entry] of Object.entries(source)) {
    const key = aaguid.toLowerCase();
    const name = entry?.name?.trim();
    if (!GUID.test(key) || !name) continue;
    providers[key] = name;
}

// The upstream README warns the list will be replaced with an empty object when retired.
if (Object.keys(providers).length === 0) throw new Error("Upstream list is empty; not overwriting");

const sorted = Object.fromEntries(Object.entries(providers).sort(([a], [b]) => a.localeCompare(b)));
const target = join(dirname(fileURLToPath(import.meta.url)), "../src/utils/passkeyProviders.json");
writeFileSync(target, JSON.stringify(sorted) + "\n");
console.log(`Wrote ${Object.keys(sorted).length} providers to ${target}`);
