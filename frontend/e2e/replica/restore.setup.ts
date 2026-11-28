import { mkdirSync, rmSync } from "node:fs";
import { expect, test as setup } from "@playwright/test";
import { contextOptions, newUser, signIn, userIdOf } from "../fixtures/users";
import { lease } from "./pool.mjs";
import {
    backendCommitsSince,
    leasesDir,
    poolDir,
    restore,
    seedMeta,
    seedSnapshot,
    start,
    usersCreated,
} from "./replica.mjs";

// Runs before the specs, on the suite's own replica (replica/replica.mjs)
setup("restore the e2e replica from its seed snapshot", async ({ browser }, info) => {
    const meta = seedMeta();
    if (meta === undefined) {
        throw new Error(
            "No e2e replica snapshot. Run `npm run seed:base` once (it needs port 8080 free), " +
                "then `npm run seed`. See README.md, or set OC_E2E_REPLICA=dev to sign users up " +
                "on your own replica instead.",
        );
    }
    const commit = meta.wasmCommit.slice(0, 10);
    const since = backendCommitsSince(meta.wasmCommit);
    if (since === undefined) {
        console.warn(
            `The e2e replica has the canisters of ${commit}, which isn't in this checkout's history.`,
        );
    } else if (since > 0) {
        console.warn(
            `The e2e replica has the canisters of ${commit}, and ${since} commits since have changed ` +
                "backend/. Run `npm run seed` to bring it up to date.",
        );
    }

    restore(seedSnapshot);
    start();
    // each run starts from the snapshot, not from what the last run left
    expect(await usersCreated(), "the replica's users after restoring the snapshot").toBe(
        meta.usersCreated,
    );
    rmSync(leasesDir, { recursive: true, force: true });
    mkdirSync(leasesDir, { recursive: true });

    // The first calls after a restore load each canister's code, which makes the first sign-in take
    // about 20s. One sign-in here pays for that, rather than the first test.
    const warmUp = lease(poolDir, leasesDir);
    const user = await newUser(browser, contextOptions(info), "warm-up", "desktop");
    await signIn(user, warmUp.passkey);
    expect(await userIdOf(user)).toBe(warmUp.userId);
    await user.context.close();
});
