import type { PartialUserSummary, UserLookup } from "./user";
import { init, _ } from "svelte-i18n";
import {
    buildUsernameList,
    compareUsername,
    extractUserIdsFromMentions,
    missingUserIds,
    userIsOnline,
} from "./user.utils";

// register("en", () => import("../../i18n/en.json"));

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

describe("extract user ids from mentions", () => {
    test("extract a single user id", () => {
        const parsed = extractUserIdsFromMentions("hello there @UserId(xyz), how are you?");
        expect(parsed).toEqual(["xyz"]);
    });
    test("extract multiple user ids", () => {
        const parsed = extractUserIdsFromMentions(
            "hello there @UserId(xyz) and hello @UserId(abc), how are you?"
        );
        expect(parsed).toEqual(["xyz", "abc"]);
    });
    test("when there are no userIds to extract", () => {
        const parsed = extractUserIdsFromMentions("this is a string that doesn't have any userIds");
        expect(parsed).toEqual([]);
    });
});

describe("get user status", () => {
    test("user is online", () => {
        expect(userIsOnline(now, lookup, "a")).toBe(true);
    });

    test("user is offline", () => {
        expect(userIsOnline(now, lookup, "b")).toBe(false);
    });

    test("unknown user is considered offline", () => {
        expect(userIsOnline(now, lookup, "c")).toBe(false);
    });
});

describe("missing userIds", () => {
    test("should work", () => {
        const missing = missingUserIds(lookup, new Set(["a", "b", "c", "d", "e"]));
        ["c", "d", "e"].forEach((u) => expect(missing.includes(u)).toBe(true));
    });
});

describe("compare username", () => {
    function toUser(username: string | undefined): PartialUserSummary {
        return { kind: "user", userId: "a", username, lastOnline: now, updated: BigInt(0) };
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

describe("build username list", () => {
    test("and you and more", () => {
        const userIds = Object.entries(lookup).map(([k, _]) => k);
        userIds.push("beta");

        const result = buildUsernameList(_, new Set(userIds), "alpha", lookup, 2);

        expect(result).toEqual("a, b, and you, and 2 more");
    });

    test("show all", () => {
        const userIds = Object.entries(lookup).map(([k, _]) => k);

        const result = buildUsernameList(_, new Set(userIds), undefined, lookup);

        expect(result).toEqual("a, b, julian_jelfs, alpha");
    });

    test("don't show 1 more", () => {
        const userIds = Object.entries(lookup).map(([k, _]) => k);

        const result = buildUsernameList(_, new Set(userIds), undefined, lookup, 3);

        expect(result).toEqual("a, b, julian_jelfs, alpha");
    });

    test("do show 1 more if missing", () => {
        const userIds = Object.entries(lookup).map(([k, _]) => k);
        userIds.push("beta");

        const result = buildUsernameList(_, new Set(userIds), undefined, lookup);

        expect(result).toEqual("a, b, julian_jelfs, alpha, and 1 more");
    });
});
