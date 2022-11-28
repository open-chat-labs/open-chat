import type { UserLookup } from "./user";
import { extractUserIdsFromMentions, missingUserIds, userIsOnline } from "./user.utils";

const now = Date.now();
jest.setSystemTime(now);

const lookup: UserLookup = {
    a: {
        kind: "user",
        userId: "a",
        username: "a",
        lastOnline: now - 119 * 1000,
        updated: BigInt(0),
        suspended: false,
    },
    b: {
        kind: "user",
        userId: "b",
        username: "b",
        lastOnline: now - 200 * 1000,
        updated: BigInt(0),
        suspended: false,
    },
    xyz: {
        kind: "user",
        userId: "xyz",
        username: "julian_jelfs",
        lastOnline: 0,
        updated: BigInt(0),
        suspended: false,
    },
    alpha: {
        kind: "user",
        userId: "alpha",
        username: "alpha",
        lastOnline: 0,
        updated: BigInt(0),
        suspended: false,
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
