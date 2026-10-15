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

// The ids a user had before being migrated to a MultiUser canister, whose wallets may still hold
// funds
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

// A summary of the current user is merged into the cached one, so carries their earlier ids too
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

    const cached = {
        ...anonymousUser(),
        userId: latest,
        previousUserIds: ["renrk-eyaaa-aaaaa-aaada-cai"],
    };
    expect(updateCreatedUser(cached, summary)).toMatchObject({
        userId: latest,
        previousUserIds: [previous],
    });
});
