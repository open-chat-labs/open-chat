// Uploads the built source maps to Rollbar so production stack traces demangle.
//
// Rollbar does not fetch source maps from your site, even when they are public (ours are). It
// only reads maps uploaded to its API, stored per project + version + minified URL. That keying
// is the point: errors are processed asynchronously, and worker.js has a fixed name, so a map
// fetched after a later deploy would demangle old traces against new source and produce line
// numbers that look right and are wrong.
//
// The URLs registered here must match what `normaliseSourceMapUrls` in openchat-shared's
// logging.ts rewrites each stack frame to. Change one and you must change the other.
//
// Usage: node scripts/upload-source-maps.mjs <version>
// Requires OC_ROLLBAR_SERVER_TOKEN - a post_server_item token from Rollbar's
// Settings -> Project Access Tokens. The client token in OC_ROLLBAR_ACCESS_TOKEN is a
// post_client_item token and the endpoint rejects it. Read from the environment, falling back
// to frontend/.env, which the build loads via dotenv but the deploy shell scripts never export.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ENDPOINT = "https://api.rollbar.com/api/1/sourcemap";
const DYNAMIC_HOST = "http://dynamichost";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = path.join(repoRoot, "frontend/app/build");

// Same as the build's dotenv.config(): fills in what the shell has not set, never overrides.
try {
    process.loadEnvFile(path.join(repoRoot, "frontend/.env"));
} catch {
    // No .env file; the token may still be in the environment.
}

const version = process.argv[2] ?? process.env.OC_WEBSITE_VERSION;
const token = process.env.OC_ROLLBAR_SERVER_TOKEN;

if (!version) {
    console.error("upload-source-maps: no version given (argv[2] or OC_WEBSITE_VERSION)");
    process.exit(1);
}

// Fatal. This once warned and exited 0, and the warning scrolled past unread on the first real
// deploy, leaving 2.0.2054 minified. The deploy scripts stop on a non-zero exit here.
if (!token) {
    console.error(
        "upload-source-maps: OC_ROLLBAR_SERVER_TOKEN is not set in the environment or in frontend/.env",
    );
    process.exit(1);
}

function findMaps(dir) {
    const found = [];
    for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) {
            found.push(...findMaps(full));
        } else if (entry.endsWith(".js.map")) {
            found.push(full);
        }
    }
    return found;
}

const maps = findMaps(buildDir);
if (maps.length === 0) {
    console.error(`upload-source-maps: no .js.map files under ${buildDir} - did the build run?`);
    process.exit(1);
}

console.log(`upload-source-maps: uploading ${maps.length} maps for ${version}`);

// A lazy chunk per route means well over a hundred uploads, so run a few at a time. Small enough
// not to look like abuse, large enough that the whole set finishes in seconds rather than minutes.
const CONCURRENCY = 8;

// A bad token fails all of them identically. Stop on the first one rather than printing the same
// 403 a hundred and seventy times.
class FatalUploadError extends Error {}

// Rollbar echoes the rejected token back in its 403 body, which would otherwise put the secret
// into terminal scrollback and CI logs.
function redact(text) {
    return text.split(token).join("<OC_ROLLBAR_SERVER_TOKEN>");
}

async function upload(mapPath) {
    // "build/main-D_Idsc5v.js.map" -> "http://dynamichost/main-D_Idsc5v.js"
    const relative = path.relative(buildDir, mapPath).split(path.sep).join("/");
    const minifiedUrl = `${DYNAMIC_HOST}/${relative.replace(/\.map$/, "")}`;

    const form = new FormData();
    form.append("access_token", token);
    form.append("version", version);
    form.append("minified_url", minifiedUrl);
    form.append("source_map", new Blob([readFileSync(mapPath)]), path.basename(mapPath));

    let response;
    try {
        response = await fetch(ENDPOINT, { method: "POST", body: form });
    } catch (err) {
        console.error(`  FAIL  ${minifiedUrl} - ${redact(String(err))}`);
        return false;
    }

    if (response.ok) return true;

    const body = redact((await response.text()).replace(/\s+/g, " ").trim());
    if (response.status === 401 || response.status === 403) {
        throw new FatalUploadError(
            `Rollbar rejected the token (${response.status}): ${body}\n` +
                "  OC_ROLLBAR_SERVER_TOKEN must be a post_server_item token from Rollbar's\n" +
                "  Settings -> Project Access Tokens, not the post_client_item one the app uses.",
        );
    }
    console.error(`  FAIL  ${minifiedUrl} - ${response.status} ${body}`);
    return false;
}

let failed = 0;
const queue = [...maps];
try {
    await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
            for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
                if (!(await upload(next))) failed++;
            }
        }),
    );
} catch (err) {
    if (!(err instanceof FatalUploadError)) throw err;
    console.error(`upload-source-maps: ${err.message}`);
    process.exit(1);
}

if (failed > 0) {
    console.error(`upload-source-maps: ${failed} of ${maps.length} uploads failed`);
    process.exit(1);
}
console.log(`upload-source-maps: all ${maps.length} maps uploaded for ${version}`);
