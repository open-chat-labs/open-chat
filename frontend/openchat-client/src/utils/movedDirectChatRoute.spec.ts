import type { DirectChatIdentifier } from "@shared";
import { describe, expect, test } from "vitest";
import { routeForMovedDirectChat } from "./movedDirectChatRoute";

const direct = (userId: string): DirectChatIdentifier => ({ kind: "direct_chat", userId });

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
