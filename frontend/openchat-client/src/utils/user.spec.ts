import type { UserLookup, UserSummary } from "openchat-shared";
import { init, addMessages, _ } from "svelte-i18n";
import { buildUsernameList, compareUsername } from "./user";
import { get } from "svelte/store";
import { vi } from "vitest";

addMessages("en", {
    you: "you",
    andNMore: ", and {n} more",
    reactions: {
        andYou: ", and you",
    },
});

const now = Date.now();
vi.setSystemTime(now);
init({
    fallbackLocale: "en",
});

const lookup: UserLookup = new Map([
    [
        "a",
        {
            kind: "user",
            userId: "a",
            username: "a",
            displayName: undefined,
            updated: BigInt(0),
            suspended: false,
            diamondStatus: "inactive",
            chitBalance: 0,
            streak: 0,
            isUniquePerson: false,
            totalChitEarned: 0,
        },
    ],
    [
        "b",
        {
            kind: "user",
            userId: "b",
            username: "b",
            displayName: undefined,
            updated: BigInt(0),
            suspended: false,
            diamondStatus: "inactive",
            chitBalance: 0,
            streak: 0,
            isUniquePerson: false,
            totalChitEarned: 0,
        },
    ],
    [
        "xyz",
        {
            kind: "user",
            userId: "xyz",
            username: "julian_jelfs",
            displayName: undefined,
            updated: BigInt(0),
            suspended: false,
            diamondStatus: "inactive",
            chitBalance: 0,
            streak: 0,
            isUniquePerson: false,
            totalChitEarned: 0,
        },
    ],
    [
        "alpha",
        {
            kind: "user",
            userId: "alpha",
            username: "alpha",
            displayName: undefined,
            updated: BigInt(0),
            suspended: false,
            diamondStatus: "inactive",
            chitBalance: 0,
            streak: 0,
            isUniquePerson: false,
            totalChitEarned: 0,
        },
    ],
]);

describe("build username list", () => {
    test.skip("and you and more", () => {
        const userIds = [...lookup.entries()].map(([k, _]) => k);
        userIds.push("beta");

        const result = buildUsernameList(get(_), new Set(userIds), "alpha", lookup, 2);

        expect(result).toEqual("a, b, and you, and 2 more");
    });

    test("show all", () => {
        const userIds = [...lookup.entries()].map(([k, _]) => k);

        const result = buildUsernameList(get(_), new Set(userIds), undefined, lookup);

        expect(result).toEqual("a, b, julian_jelfs, alpha");
    });

    test("don't show 1 more", () => {
        const userIds = [...lookup.entries()].map(([k, _]) => k);

        const result = buildUsernameList(get(_), new Set(userIds), undefined, lookup, 3);

        expect(result).toEqual("a, b, julian_jelfs, alpha");
    });

    test.skip("do show 1 more if missing", () => {
        const userIds = [...lookup.entries()].map(([k, _]) => k);
        userIds.push("beta");

        const result = buildUsernameList(get(_), new Set(userIds), undefined, lookup);

        expect(result).toEqual("a, b, julian_jelfs, alpha, and 1 more");
    });
});

describe("compare username", () => {
    function toUser(username: string): UserSummary {
        return {
            kind: "user",
            userId: "a",
            username,
            displayName: undefined,
            updated: BigInt(0),
            suspended: false,
            diamondStatus: "inactive",
            chitBalance: 0,
            streak: 0,
            isUniquePerson: false,
            totalChitEarned: 0,
        };
    }
    test("works with non-null usernames", () => {
        const users = ["zulu", "yanky", "foxtrot", "lima"].map(toUser);
        const sorted = users.sort(compareUsername);
        expect(sorted.map((u) => u.username)).toEqual(["foxtrot", "lima", "yanky", "zulu"]);
    });
});
