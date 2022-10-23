import type { UserLookup } from "openchat-agent";
import { init, addMessages, _ } from "svelte-i18n";
import { buildUsernameList } from "./user";
import { get } from "svelte/store";

addMessages("en", {
    you: "you",
    andNMore: ", and {n} more",
    reactions: {
        andYou: ", and you",
    },
});

const now = Date.now();
jest.setSystemTime(now);
init({
    fallbackLocale: "en",
});

const lookup: UserLookup = {
    a: {
        kind: "user",
        userId: "a",
        username: "a",
        lastOnline: now - 119 * 1000,
        updated: BigInt(0),
    },
    b: {
        kind: "user",
        userId: "b",
        username: "b",
        lastOnline: now - 200 * 1000,
        updated: BigInt(0),
    },
    xyz: {
        kind: "user",
        userId: "xyz",
        username: "julian_jelfs",
        lastOnline: 0,
        updated: BigInt(0),
    },
    alpha: {
        kind: "user",
        userId: "alpha",
        username: "alpha",
        lastOnline: 0,
        updated: BigInt(0),
    },
};

describe("build username list", () => {
    test("and you and more", () => {
        const userIds = Object.entries(lookup).map(([k, _]) => k);
        userIds.push("beta");

        const result = buildUsernameList(get(_), new Set(userIds), "alpha", lookup, 2);

        expect(result).toEqual("a, b, and you, and 2 more");
    });

    test("show all", () => {
        const userIds = Object.entries(lookup).map(([k, _]) => k);

        const result = buildUsernameList(get(_), new Set(userIds), undefined, lookup);

        expect(result).toEqual("a, b, julian_jelfs, alpha");
    });

    test("don't show 1 more", () => {
        const userIds = Object.entries(lookup).map(([k, _]) => k);

        const result = buildUsernameList(get(_), new Set(userIds), undefined, lookup, 3);

        expect(result).toEqual("a, b, julian_jelfs, alpha");
    });

    test("do show 1 more if missing", () => {
        const userIds = Object.entries(lookup).map(([k, _]) => k);
        userIds.push("beta");

        const result = buildUsernameList(get(_), new Set(userIds), undefined, lookup);

        expect(result).toEqual("a, b, julian_jelfs, alpha, and 1 more");
    });
});
