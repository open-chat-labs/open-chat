import type { DirectChatIdentifier } from "@shared";
import { describe, expect, test } from "vitest";
import { movedDirectChats } from "./movedDirectChats";

const direct = (userId: string): DirectChatIdentifier => ({ kind: "direct_chat", userId });

describe("movedDirectChats", () => {
    const latest = new Map([
        ["old1", "new1"],
        ["old2", "new2"],
    ]);
    const latestUserId = (userId: string) => latest.get(userId) ?? userId;

    test("a chat removed under a migrated user's old id is mapped to the chat under their new id", () => {
        const moved = movedDirectChats(["old1"], latestUserId, (id) => id.userId === "new1");

        expect(moved).toEqual(new Map([["old1", direct("new1")]]));
    });

    test("a chat removed under the id its user still has was deleted, not moved", () => {
        const moved = movedDirectChats(["u1"], latestUserId, () => true);

        expect(moved.size).toBe(0);
    });

    test("a chat whose migrated user there is no chat with under their new id was deleted, not moved", () => {
        const moved = movedDirectChats(["old1", "old2"], latestUserId, (id) => id.userId === "new2");

        expect(moved).toEqual(new Map([["old2", direct("new2")]]));
    });
});
