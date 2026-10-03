import { describe, expect, test } from "vitest";
import { movedDirectChats } from "./movedDirectChats";

describe("movedDirectChats", () => {
    const latestUserIds = new Map([
        ["old1", "new1"],
        ["old2", "new2"],
    ]);

    test("a chat removed under a migrated user's old id is mapped to the chat added under their new id", () => {
        expect(movedDirectChats(["old1"], ["new1", "other"], latestUserIds)).toEqual(
            new Map([["old1", "new1"]]),
        );
    });

    test("a chat removed under the id its user still has was deleted, not moved", () => {
        expect(movedDirectChats(["u1"], ["u1"], latestUserIds).size).toBe(0);
    });

    test("a chat whose migrated user had no chat added under their new id was deleted, not moved", () => {
        // As when both were kept, the one under the new id having come first, and the one under
        // the old id is then deleted
        expect(movedDirectChats(["old1", "old2"], ["new2"], latestUserIds)).toEqual(
            new Map([["old2", "new2"]]),
        );
    });
});
