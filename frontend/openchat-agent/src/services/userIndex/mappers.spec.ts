import { describe, expect, test } from "vitest";
import { principalStringToBytes } from "../../utils/mapping";
import { dropInvalidUserIds, userSummaryUpdate } from "./mappers";

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
