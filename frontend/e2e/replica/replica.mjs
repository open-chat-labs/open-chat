// The e2e suite's own replica (#10550). It runs in a checkout of its own (dfx keeps a project's
// replica in that project's .dfx, and `dfx start` can't pick another network), on its own port, so
// a developer's replica on 8080 is never touched. Each run restores it from a snapshot:
//
//   base   the NNS canisters only. Made once by `npm run seed:base`, which needs port 8080
//   seed   base plus OpenChat and a pool of signed-up users. Made by `npm run seed`, again
//          whenever the canisters change
//
// A snapshot is the replica's state directory (network/) and its canister ids (local/), copied
// after a graceful `dfx stop`: a hard kill leaves PocketIC's topology.json behind its subnets'
// checkpoints, and it then refuses to load them.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const e2eDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const repoRoot = path.resolve(e2eDir, "../..");

/** The checkout the replica runs in: by default a worktree beside this one. */
export const replicaDir =
    process.env.OC_E2E_REPLICA_DIR ?? path.resolve(repoRoot, "..", "oc-e2e-replica");
export const snapshotsDir =
    process.env.OC_E2E_SNAPSHOTS_DIR ?? path.resolve(repoRoot, "..", "oc-e2e-snapshots");
export const replicaPort = Number(process.env.OC_E2E_REPLICA_PORT ?? 8090);

/**
 * Whether the suite runs on this replica: it does unless it's pointed at a server that's already
 * running (OC_E2E_URL), or at the developer's own replica (OC_E2E_REPLICA=dev), where tests sign
 * their users up instead.
 */
export const ownReplica = !process.env.OC_E2E_URL && process.env.OC_E2E_REPLICA !== "dev";

export const baseSnapshot = path.join(snapshotsDir, "base");
export const seedSnapshot = path.join(snapshotsDir, "seed");
/** The seed snapshot's users, one JSON file each: { username, userId, passkey }. */
export const poolDir = path.join(seedSnapshot, "pool");
/** Where a run's tests claim pool users, emptied when the run restores the replica. */
export const leasesDir = path.join(snapshotsDir, "run", "leases");
export const canisterIdsPath = path.join(seedSnapshot, "local", "canister_ids.json");

/** `{ wasmCommit, poolSize, usersCreated, createdAt }`, or undefined if there's no seed snapshot. */
export function seedMeta() {
    const file = path.join(seedSnapshot, "meta.json");
    return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : undefined;
}

export function writeMeta(snapshot, meta) {
    writeFileSync(path.join(snapshot, "meta.json"), JSON.stringify(meta, null, 2));
}

function dfx(args, options = {}) {
    return execFileSync("dfx", args, { cwd: replicaDir, encoding: "utf8", ...options });
}

/** A copy that shares blocks with the original where the filesystem can: snapshots are ~1GB. */
function cloneDir(from, to) {
    const flags = process.platform === "darwin" ? ["-cR"] : ["-R", "--reflink=auto"];
    execFileSync("cp", [...flags, from, to]);
}

/** Stops the replica gracefully, if it's running. */
export function stop() {
    if (existsSync(path.join(replicaDir, ".dfx"))) dfx(["stop"], { stdio: "ignore" });
}

export function start(host = `127.0.0.1:${replicaPort}`) {
    // stderr goes to the terminal, so a failure says why. Not piped: the replica it leaves running
    // holds the pipe open, and this would wait for it forever
    dfx(["start", "--background", "--host", host], { stdio: ["ignore", "ignore", "inherit"] });
}

/** Stops the replica and replaces its state and canister ids with `snapshot`'s. */
export function restore(snapshot) {
    stop();
    const dotDfx = path.join(replicaDir, ".dfx");
    for (const dir of ["network/local", "local"])
        rmSync(path.join(dotDfx, dir), { recursive: true, force: true });
    mkdirSync(path.join(dotDfx, "network"), { recursive: true });
    const network = path.join(dotDfx, "network", "local");
    cloneDir(path.join(snapshot, "network"), network);
    if (existsSync(path.join(snapshot, "local")))
        cloneDir(path.join(snapshot, "local"), path.join(dotDfx, "local"));

    // The config holds the state's absolute paths, and dfx won't start on state saved from another
    // directory ("The network state can't be reused with this configuration")
    const config = path.join(network, "replica-effective-config.json");
    const here = `"${network}/`;
    writeFileSync(
        config,
        readFileSync(config, "utf8").replace(/"\/[^"]*\/\.dfx\/network\/local\//g, here),
    );
}

/** Stops the replica and copies its state and canister ids to `snapshot`, which mustn't exist. */
export function save(snapshot) {
    stop();
    mkdirSync(snapshot, { recursive: true });
    const dotDfx = path.join(replicaDir, ".dfx");
    cloneDir(path.join(dotDfx, "network", "local"), path.join(snapshot, "network"));
    // which process and ports this run had
    for (const file of ["pid", "pocket-ic-pid", "pocket-ic-port", "webserver-port"]) {
        rmSync(path.join(snapshot, "network", file), { force: true });
    }
    if (existsSync(path.join(dotDfx, "local")))
        cloneDir(path.join(dotDfx, "local"), path.join(snapshot, "local"));
}

/** Makes the replica's checkout, at `commit`, or moves it there. */
export function checkOutReplica(commit) {
    const git = (cwd, ...args) => execFileSync("git", args, { cwd, stdio: "inherit" });
    if (existsSync(replicaDir)) {
        git(replicaDir, "fetch", "-q", "origin", "master");
        git(replicaDir, "checkout", "-q", "--detach", commit);
    } else {
        git(repoRoot, "fetch", "-q", "origin", "master");
        git(repoRoot, "worktree", "add", "--detach", replicaDir, commit);
    }
}

/** How many commits since the snapshot's wasms changed backend/ here, or undefined if unknown. */
export function backendCommitsSince(commit) {
    try {
        const count = execFileSync(
            "git",
            ["rev-list", "--count", `${commit}..HEAD`, "--", "backend"],
            { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
        );
        return Number(count.trim());
    } catch {
        return undefined;
    }
}

/** The number of users user_index has created, from its metrics. */
export async function usersCreated() {
    const ids = JSON.parse(
        readFileSync(path.join(replicaDir, ".dfx", "local", "canister_ids.json"), "utf8"),
    );
    const url = `http://${ids.user_index.local}.raw.localhost:${replicaPort}/metrics`;
    const metrics = await (await fetch(url)).json();
    return metrics.users_created;
}

export function portInUse(port) {
    return new Promise((resolve) => {
        const socket = net.connect(port, "127.0.0.1");
        socket.once("connect", () => {
            socket.destroy();
            resolve(true);
        });
        socket.once("error", () => resolve(false));
    });
}
