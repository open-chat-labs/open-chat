// `npm run seed`: the seed snapshot the suite restores before each run. It restores the base
// snapshot, deploys OpenChat's latest wasms on it, signs up a pool of users through the app and
// saves their passkeys with the replica's state. Run it again when the canisters change; the suite
// warns when backend/ has moved on since the snapshot's wasms.
//
//   OC_E2E_POOL_SIZE   users to sign up (100)
//   OC_E2E_WASMS       the commit whose wasms to deploy (the latest master build's)

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, readdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    baseSnapshot,
    checkOutReplica,
    replicaDir,
    replicaPort,
    restore,
    save,
    seedSnapshot,
    snapshotsDir,
    start,
    stop,
    usersCreated,
    writeMeta,
} from "./replica.mjs";

const e2eDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const poolSize = Number(process.env.OC_E2E_POOL_SIZE ?? 100);
// the app the pool signs up through, beside the suite's own (5090)
const appPort = 5091;

if (!existsSync(baseSnapshot)) {
    console.error(`No base snapshot in ${baseSnapshot}: run \`npm run seed:base\` first.`);
    process.exit(1);
}

const wasmCommit =
    process.env.OC_E2E_WASMS ??
    (await (await fetch("https://openchat-canister-wasms.s3.amazonaws.com/latest")).text()).trim();
console.log(`Seeding the e2e replica with the wasms of ${wasmCommit}`);

checkOutReplica(wasmCommit);
restore(baseSnapshot);
start();

let app;
try {
    // deploy-local.sh skips the NNS install: the base snapshot has the canisters
    execFileSync("./scripts/deploy-local.sh", ["default", wasmCommit], {
        cwd: replicaDir,
        env: { ...process.env, OC_REPLICA_PORT: String(replicaPort) },
        stdio: "inherit",
    });

    const log = path.join(snapshotsDir, "seed-app.log");
    console.log(`Building the app to sign the pool up through (log: ${log})`);
    app = spawn("npm", ["run", "dev:native"], {
        cwd: path.resolve(e2eDir, ".."),
        env: {
            ...process.env,
            OC_DEV_PORT: String(appPort),
            OC_E2E: "true",
            OC_E2E_BUNDLE: "true",
            OC_REPLICA_PORT: String(replicaPort),
            OC_CANISTER_IDS_PATH: path.join(replicaDir, ".dfx", "local", "canister_ids.json"),
            OC_VITE_CACHE_DIR: "node_modules/.vite-e2e",
        },
        // its own process group, so it can be stopped with everything it starts
        detached: true,
        stdio: ["ignore", openSync(log, "w"), openSync(log, "a")],
    });
    const appUrl = `http://localhost:${appPort}`;
    await waitFor(appUrl, 600_000);

    const next = `${seedSnapshot}-next`;
    rmSync(next, { recursive: true, force: true });
    const poolDir = path.join(next, "pool");
    mkdirSync(poolDir, { recursive: true });
    console.log(`Signing up ${poolSize} users`);
    execFileSync("npx", ["playwright", "test", "-c", "replica/seed.config.ts"], {
        cwd: e2eDir,
        env: {
            ...process.env,
            OC_E2E_URL: appUrl,
            OC_E2E_POOL_DIR: poolDir,
            OC_E2E_POOL_SIZE: String(poolSize),
        },
        stdio: "inherit",
    });
    const signedUp = readdirSync(poolDir).length;
    if (signedUp !== poolSize) throw new Error(`Signed up ${signedUp} of ${poolSize} users`);
    // more than the pool if a sign-up was retried; each run checks its restore against this
    const created = await usersCreated();

    save(next);
    writeMeta(next, {
        wasmCommit,
        poolSize,
        usersCreated: created,
        createdAt: new Date().toISOString(),
    });
    rmSync(seedSnapshot, { recursive: true, force: true });
    renameSync(next, seedSnapshot);
    console.log(`Saved the seed snapshot to ${seedSnapshot}`);
} finally {
    if (app) process.kill(-app.pid);
    stop();
}

async function waitFor(url, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            if ((await fetch(url)).ok) return;
        } catch {
            // not up yet
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error(`${url} didn't come up in ${timeoutMs / 1000}s`);
}
