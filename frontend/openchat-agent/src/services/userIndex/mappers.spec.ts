import { anonymousUser, updateCreatedUser } from "@shared";
import { describe, expect, test } from "vitest";
import type {
    UserIndexCurrentUserResponse,
    CurrentUserSummary as TCurrentUserSummary,
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

    test("leaves previousUserIds undefined when the field is omitted", () => {
        const update = userSummaryUpdate({ user_id: principalStringToBytes(latest) });
        expect(update.previousUserIds).toBeUndefined();
    });
});

// The ids a user had before being migrated to a MultiUser canister, which events from before then
// still refer to them by
describe("the current user's previous ids", () => {
    const latest = "dfdal-2uaaa-aaaaa-qaama-cai";
    const previous = "rrkah-fqaaa-aaaaa-aaaaq-cai";
    const fields = {
        user_id: principalStringToBytes(latest),
        username: "me",
        previous_user_ids: [principalStringToBytes(previous)],
    };

    test("come with the current user", () => {
        const response = currentUserResponse({
            Success: { ...fields, icp_account: new Uint8Array(32) },
        } as unknown as UserIndexCurrentUserResponse);

        expect(response).toMatchObject({ kind: "created_user", previousUserIds: [previous] });
    });

    test("come with a summary of the current user, and are kept when one comes without them", () => {
        const summary = currentUserSummary(fields as unknown as TCurrentUserSummary, 1n);
        expect(summary.previousUserIds).toEqual([previous]);

        const created = updateCreatedUser(anonymousUser(), summary);
        expect(created.previousUserIds).toEqual([previous]);

        const withoutIds = currentUserSummary(
            { ...fields, previous_user_ids: undefined } as unknown as TCurrentUserSummary,
            2n,
        );
        expect(updateCreatedUser(created, withoutIds).previousUserIds).toEqual([previous]);
    });
});
