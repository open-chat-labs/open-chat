import type { DirectChatIdentifier } from "@shared";
import { describe, expect, test } from "vitest";
import { movedDirectChats, routeForMovedDirectChat } from "./movedDirectChats";

const direct = (userId: string): DirectChatIdentifier => ({ kind: "direct_chat", userId });

describe("movedDirectChats", () => {
    const latest = new Map([
        ["old1", "new1"],
        ["old2", "new2"],
    ]);
    const latestUserId = (userId: string) => latest.get(userId) ?? userId;

    test("a chat removed under a migrated user's old id is mapped to the chat added under their new id", () => {
        const moved = movedDirectChats(["old1"], latestUserId, (id) => id.userId === "new1");

        expect(moved).toEqual(new Map([["old1", direct("new1")]]));
    });

    test("a chat removed under the id its user still has was deleted, not moved", () => {
        const moved = movedDirectChats(["u1"], latestUserId, () => true);

        expect(moved.size).toBe(0);
    });

    test("a chat whose migrated user had no chat added under their new id was deleted, not moved", () => {
        const moved = movedDirectChats(
            ["old1", "old2"],
            latestUserId,
            (id) => id.userId === "new2",
        );

        expect(moved).toEqual(new Map([["old2", direct("new2")]]));
    });
});

describe("routeForMovedDirectChat", () => {
    test("the chat, if the route was to the chat", () => {
        expect(routeForMovedDirectChat("chats", direct("new"), undefined, undefined, false)).toBe(
            "/chats/user/new",
        );
    });

    test("the same message", () => {
        expect(routeForMovedDirectChat("chats", direct("new"), 5, undefined, false)).toBe(
            "/chats/user/new/5",
        );
    });

    test("the same thread, still open", () => {
        expect(routeForMovedDirectChat("chats", direct("new"), 5, undefined, true)).toBe(
            "/chats/user/new/5?open=true",
        );
    });

    test("the same message in the same thread", () => {
        expect(routeForMovedDirectChat("favourite", direct("new"), 5, 2, false)).toBe(
            "/favourite/user/new/5/2?open=true",
        );
    });
});
