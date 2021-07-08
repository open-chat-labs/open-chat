import type { UserLookup } from "./user";
import { mergeUsers, missingUserIds, userIsOnline } from "./user.utils";

const lookup: UserLookup = {
    a: {
        userId: "a",
        username: "a",
        secondsSinceLastOnline: 119,
    },
    b: {
        userId: "b",
        username: "b",
        secondsSinceLastOnline: 200,
    },
};

describe("get user status", () => {
    test("user is online", () => {
        expect(userIsOnline(lookup, "a")).toBe(true);
    });

    test("user is offline", () => {
        expect(userIsOnline(lookup, "b")).toBe(false);
    });

    test("unknown user is considered offline", () => {
        expect(userIsOnline(lookup, "c")).toBe(false);
    });
});

describe("merge users", () => {
    test("should work", () => {
        // clone the lookup so that the test remains isolated
        const merged = mergeUsers({ ...lookup }, [
            { userId: "a", username: "a - updated", secondsSinceLastOnline: 20 },
            { userId: "c", username: "c", secondsSinceLastOnline: 20 },
        ]);

        expect(merged["a"].username).toEqual("a - updated");
        expect(merged["c"].username).toEqual("c");
    });
});

describe("missing userIds", () => {
    test("should work", () => {
        const missing = missingUserIds(lookup, new Set(["a", "b", "c", "d", "e"]));
        ["c", "d", "e"].forEach((u) => expect(missing.includes(u)).toBe(true));
    });
});
