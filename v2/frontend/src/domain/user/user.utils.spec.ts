import type { UserLookup } from "./user";
import {
    compareUsername,
    extractUserIdsFromMentions,
    missingUserIds,
    parseMentions,
    userIsOnline,
} from "./user.utils";

const now = Date.now();
jest.setSystemTime(now);

const lookup: UserLookup = {
    a: {
        userId: "a",
        username: "a",
        lastOnline: now - 119 * 1000,
        updated: BigInt(0),
    },
    b: {
        userId: "b",
        username: "b",
        lastOnline: now - 200 * 1000,
        updated: BigInt(0),
    },
    xyz: {
        userId: "xyz",
        username: "julian_jelfs",
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

describe("parse mentions", () => {
    test("replace a single mention", () => {
        const parsed = parseMentions(lookup, "hello there @UserId(xyz), how are you?", "unknown");
        expect(parsed).toEqual("hello there **@julian_jelfs**, how are you?");
    });

    test("text is unchanged where there are no mentions", () => {
        const parsed = parseMentions(lookup, "hello there, how are you?", "unknown");
        expect(parsed).toEqual("hello there, how are you?");
    });

    test("mention of an unknown user", () => {
        const parsed = parseMentions(lookup, "hello there @UserId(abc), how are you?", "unknown");
        expect(parsed).toEqual("hello there **@unknown**, how are you?");
    });

    test("replace multiple mentions", () => {
        const parsed = parseMentions(
            lookup,
            "hello there @UserId(xyz), how are you @UserId(xyz)?",
            "unknown"
        );
        expect(parsed).toEqual("hello there **@julian_jelfs**, how are you **@julian_jelfs**?");
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
    function toUser(username: string | undefined) {
        return { userId: "a", username, lastOnline: now, updated: BigInt(0) };
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
