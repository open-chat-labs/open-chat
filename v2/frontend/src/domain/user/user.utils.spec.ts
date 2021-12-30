import type { UserLookup } from "./user";
import { compareUsername, missingUserIds, userIsOnline } from "./user.utils";

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
};

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
