import { describe, expect, test } from "vitest";
import { membersWithPresenceShown } from "./memberPresence";

const ids = ["a", "b", "c"];

describe("whose presence a group panel looks up", () => {
    test("everyone on the quick panel's main page, which counts who's online", () => {
        expect(membersWithPresenceShown({ view: undefined, quick: true }, ids)).toEqual(ids);
        expect(membersWithPresenceShown({ view: "main", quick: true }, ids)).toEqual(ids);
    });

    test("nobody on the quick panel's pinned messages", () => {
        expect(membersWithPresenceShown({ view: "pinned", quick: true }, ids)).toEqual([]);
    });

    test("everyone on the full panel's Members page, embedded in Manage too", () => {
        expect(membersWithPresenceShown({ view: "members", quick: false }, ids)).toEqual(ids);
    });

    test("nobody on the full panel's overview, whose few members have no dot", () => {
        expect(membersWithPresenceShown({ view: undefined, quick: false }, ids)).toEqual([]);
        expect(membersWithPresenceShown({ view: "main", quick: false }, ids)).toEqual([]);
    });

    test("nobody on the pages that show no members", () => {
        for (const view of ["bots", "rules", "permissions", "gates", "pinned", "usergroups"]) {
            expect(membersWithPresenceShown({ view, quick: false }, ids)).toEqual([]);
        }
    });
});
