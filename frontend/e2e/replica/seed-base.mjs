// `npm run seed:base`: the base snapshot, the NNS canisters on an otherwise empty replica. The NNS
// extension only installs on port 8080, so this needs 8080 free: stop your own replica first. Run
// it once, or when the NNS canisters change.

import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import {
    baseSnapshot,
    checkOutReplica,
    portInUse,
    replicaDir,
    save,
    stop,
    writeMeta,
} from "./replica.mjs";

if (await portInUse(8080)) {
    console.error(
        "seed:base needs port 8080, because `dfx nns install` installs nowhere else, and something " +
            "is using it. Stop your replica (`dfx stop`), run this again, then start it again " +
            "(`dfx start --background`, without --clean, keeps its state).",
    );
    process.exit(1);
}

const commit = execFileSync("git", ["rev-parse", "origin/master"], { encoding: "utf8" }).trim();
checkOutReplica(commit);
stop();

const dfx = (...args) =>
    execFileSync("dfx", args, {
        cwd: replicaDir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "inherit"],
    });

// dfx.json binds the project's replica to 8080
dfx("start", "--clean", "--background");
try {
    // the version deploy-local.sh installs
    try {
        dfx("extension", "install", "nns", "--version", "0.8.0");
    } catch {
        dfx("extension", "uninstall", "nns");
        dfx("extension", "install", "nns", "--version", "0.8.0");
    }
    const account = dfx("--identity", "default", "ledger", "account-id").trim();
    console.log("Installing the NNS canisters");
    dfx("--identity", "default", "nns", "install", "--ledger-accounts", account);
    // the SNS aggregator only fills the replica's log
    dfx("--identity", "anonymous", "canister", "stop", "sgymv-uiaaa-aaaaa-aaaia-cai");

    rmSync(baseSnapshot, { recursive: true, force: true });
    save(baseSnapshot);
    writeMeta(baseSnapshot, { createdAt: new Date().toISOString() });
    console.log(`Saved the base snapshot to ${baseSnapshot}. Next: npm run seed`);
} finally {
    // free 8080 for your own replica, whatever happened
    stop();
}
