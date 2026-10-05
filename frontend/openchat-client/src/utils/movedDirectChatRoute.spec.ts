import type { DirectChatIdentifier } from "@shared";
import { describe, expect, test } from "vitest";
import { routeForMovedDirectChat } from "./movedDirectChatRoute";

const direct = (userId: string): DirectChatIdentifier => ({ kind: "direct_chat", userId });

describe("routeForMovedDirectChat", () => {
    test("the chat, if the route was to the chat", () => {
        expect(routeForMovedDirectChat("chats", direct("new"), undefined)).toBe("/chats/user/new");
    });

    test("the same message", () => {
        expect(routeForMovedDirectChat("chats", direct("new"), 5)).toBe("/chats/user/new/5");
    });

    test("in the scope given", () => {
        expect(routeForMovedDirectChat("favourite", direct("new"), 5)).toBe(
            "/favourite/user/new/5",
        );
    });
});
