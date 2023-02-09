import type { UserLookup } from "./user";
import { extractUserIdsFromMentions, missingUserIds } from "./user.utils";

const now = Date.now();
jest.setSystemTime(now);

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

describe("missing userIds", () => {
    test("should work", () => {
        const missing = missingUserIds(lookup, new Set(["a", "b", "c", "d", "e"]));
        ["c", "d", "e"].forEach((u) => expect(missing.includes(u)).toBe(true));
    });
});
