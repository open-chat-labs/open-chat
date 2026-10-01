import { ROLE_ADMIN, ROLE_MEMBER, type Member } from "@shared";
import { describe, expect, test } from "vitest";
import { addLookedUpMembers, type HeldMembers } from "./members";

function member(userId: string, displayName?: string): Member {
    return { userId, role: ROLE_MEMBER, displayName, lapsed: false };
}

function held(timestamp = 10n): HeldMembers {
    return {
        timestamp,
        members: new Map([
            ["a", member("a")],
            ["b", { ...member("b"), role: ROLE_ADMIN }],
        ]),
        lapsedMembers: new Set(["l"]),
        moreMembersAfter: "b",
    };
}

describe("addLookedUpMembers", () => {
    test("members who aren't held are added, lapsed members as lapsed", () => {
        const added = addLookedUpMembers(
            held(),
            [member("x", "X"), { ...member("y"), lapsed: true }],
            10n,
        );

        expect([...(added?.members.keys() ?? [])]).toEqual(["a", "b", "x"]);
        expect(added?.members.get("x")?.displayName).toBe("X");
        expect([...(added?.lapsedMembers ?? [])]).toEqual(["l", "y"]);
    });

    test("members already held are left as they are", () => {
        const original = held();

        const added = addLookedUpMembers(original, [member("b"), member("l"), member("x")], 10n);

        // `b` is still an admin, and `l` still lapsed, as the updates to the details say
        expect(added?.members.get("b")?.role).toBe(ROLE_ADMIN);
        expect(added?.members.has("l")).toBe(false);
        expect(added?.lapsedMembers.has("l")).toBe(true);
        // What is held isn't changed in place
        expect(original.members.has("x")).toBe(false);
    });

    test("nothing is added if every member found is held already", () => {
        expect(addLookedUpMembers(held(), [member("a"), member("l")], 10n)).toBeUndefined();
        expect(addLookedUpMembers(held(), [], 10n)).toBeUndefined();
    });

    test("nothing is added if the details have been updated since the lookup was sent", () => {
        expect(addLookedUpMembers(held(20n), [member("x")], 10n)).toBeUndefined();
        // but they may since have been found to be up to date as of when it was sent
        expect(addLookedUpMembers(held(10n), [member("x")], 20n)).toBeDefined();
    });
});
