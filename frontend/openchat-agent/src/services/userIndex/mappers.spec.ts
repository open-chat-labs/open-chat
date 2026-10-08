import { anonymousUser, updateCreatedUser } from "@shared";
import { describe, expect, test } from "vitest";
import type {
    CurrentUserSummary as TCurrentUserSummary,
    UserIndexCurrentUserResponse,
} from "../../typebox";
import { principalStringToBytes } from "../../utils/mapping";
import {
    currentUserResponse,
    currentUserSummary,
    dropInvalidUserIds,
    userMigrationResponse,
    userSummaryUpdate,
} from "./mappers";

describe("dropInvalidUserIds", () => {
    // Invariant: a user id that is not a principal never reaches Principal.fromText. Referral
    // links carrying a username ("?ref=thebitcoinstorm") put one into getUsers and the throw
    // took the whole batch with it (Rollbar #31609, #31687).
    test("drops ids that are not principals and keeps the rest", () => {
        const args = {
            userGroups: [
                {
                    users: ["thebitcoinstorm", "9", "dfdal-2uaaa-aaaaa-qaama-cai"],
                    updatedSince: 0n,
                },
                { users: ["xxxxxxxxxx"], updatedSince: 5n },
            ],
        };
        expect(dropInvalidUserIds(args)).toEqual({
            userGroups: [
                { users: ["dfdal-2uaaa-aaaaa-qaama-cai"], updatedSince: 0n },
                { users: [], updatedSince: 5n },
            ],
        });
    });
});

describe("userSummaryUpdate", () => {
    const latest = "dfdal-2uaaa-aaaaa-qaama-cai";
    const previous = ["ryjl3-tyaaa-aaaaa-aaaba-cai", "rrkah-fqaaa-aaaaa-aaaaq-cai"];

    test("maps the ids a migrated user had before their latest one", () => {
        const update = userSummaryUpdate({
            user_id: principalStringToBytes(latest),
            previous_user_ids: previous.map(principalStringToBytes),
        });
        expect(update.userId).toEqual(latest);
        expect(update.previousUserIds).toEqual(previous);
    });
});

// The ids a user had before being migrated to a MultiUser canister, which events from before then
// still refer to them by
test("the current user comes with their previous ids", () => {
    const latest = "dfdal-2uaaa-aaaaa-qaama-cai";
    const previous = "rrkah-fqaaa-aaaaa-aaaaq-cai";
    const response = currentUserResponse({
        Success: {
            user_id: principalStringToBytes(latest),
            username: "me",
            previous_user_ids: [principalStringToBytes(previous)],
            icp_account: new Uint8Array(32),
        },
    } as unknown as UserIndexCurrentUserResponse);

    expect(response).toMatchObject({ kind: "created_user", previousUserIds: [previous] });
});

// A summary of the current user under a new id, the user having been migrated during the session,
// replaces the cached one, and has to carry the earlier ids for the next session to map them
test("a current user summary comes with the previous ids, which replace the cached user's", () => {
    const latest = "dfdal-2uaaa-aaaaa-qaama-cai";
    const previous = "rrkah-fqaaa-aaaaa-aaaaq-cai";
    const summary = currentUserSummary(
        {
            user_id: principalStringToBytes(latest),
            username: "me",
            previous_user_ids: [principalStringToBytes(previous)],
        } as unknown as TCurrentUserSummary,
        1n,
    );
    expect(summary.previousUserIds).toEqual([previous]);

    const cached = { ...anonymousUser(), userId: previous };
    expect(updateCreatedUser(cached, summary)).toMatchObject({
        userId: latest,
        previousUserIds: [previous],
    });
});

describe("userMigrationResponse", () => {
    const userId = "dfdal-2uaaa-aaaaa-qaama-cai";
    const multiUserCanisterId = "ryjl3-tyaaa-aaaaa-aaaba-cai";
    const multi_user_canister_id = principalStringToBytes(multiUserCanisterId);

    test("maps each stage of a migration", () => {
        expect(userMigrationResponse("NotFound")).toEqual({ kind: "not_found" });
        expect(userMigrationResponse({ Success: "Queued" })).toEqual({ kind: "queued" });
        expect(
            userMigrationResponse({
                Success: { Requested: { multi_user_canister_id, timestamp: 1n } },
            }),
        ).toEqual({ kind: "requested", multiUserCanisterId, timestamp: 1n });
        expect(
            userMigrationResponse({
                Success: {
                    Started: {
                        multi_user_canister_id,
                        timestamp: 2n,
                        user_bytes: 1000n,
                        wasm_version: { major: 2, minor: 0, patch: 2077 },
                    },
                },
            }),
        ).toEqual({
            kind: "started",
            multiUserCanisterId,
            timestamp: 2n,
            userBytes: 1000n,
            wasmVersion: "2.0.2077",
        });
        expect(
            userMigrationResponse({
                Success: {
                    Imported: {
                        multi_user_canister_id,
                        timestamp: 3n,
                        new_user_id: principalStringToBytes(userId),
                    },
                },
            }),
        ).toEqual({ kind: "imported", multiUserCanisterId, timestamp: 3n, newUserId: userId });
        expect(
            userMigrationResponse({
                Success: {
                    Failed: { multi_user_canister_id, timestamp: 4n, error: [100, "Frozen"] },
                },
            }),
        ).toEqual({
            kind: "failed",
            multiUserCanisterId,
            timestamp: 4n,
            error: { kind: "error", code: 100, message: "Frozen" },
        });
    });
});
