import type { PartialUserSummary, UserLookup } from "openchat-shared";
import { init, addMessages, _ } from "svelte-i18n";
import { buildUsernameList, compareUsername } from "./user";
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
        updated: BigInt(0),
        suspended: false,
        diamond: false,
    },
    b: {
        kind: "user",
        userId: "b",
        username: "b",
        updated: BigInt(0),
        suspended: false,
        diamond: false,
    },
    xyz: {
        kind: "user",
        userId: "xyz",
        username: "julian_jelfs",
        updated: BigInt(0),
        suspended: false,
        diamond: false,
    },
    alpha: {
        kind: "user",
        userId: "alpha",
        username: "alpha",
        updated: BigInt(0),
        suspended: false,
        diamond: false,
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

describe("compare username", () => {
    function toUser(username: string | undefined): PartialUserSummary {
        return {
            kind: "user",
            userId: "a",
            username,
            updated: BigInt(0),
            suspended: false,
            diamond: false,
        };
    }
    test("works with non-null usernames", () => {
        const users = ["zulu", "yanky", "foxtrot", "lima"].map(toUser);
        const sorted = users.sort(compareUsername);
        expect(sorted.map((u) => u.username)).toEqual(["foxtrot", "lima", "yanky", "zulu"]);
    });

    test("works with non-null usernames", () => {
        const users = ["zulu", undefined, "yanky", undefined, "foxtrot", "lima"].map(toUser);
        const sorted = users.sort(compareUsername);
        expect(sorted.map((u) => u.username)).toEqual([
            "foxtrot",
            "lima",
            "yanky",
            "zulu",
            undefined,
            undefined,
        ]);
    });
});
