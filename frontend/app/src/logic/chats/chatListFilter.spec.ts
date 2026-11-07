import type { ChatSummary } from "@client";
import { describe, expect, test } from "vitest";
import { chatListFilterFrom, passesChatListFilter } from "./chatListFilter";

const dm = { kind: "direct_chat" } as ChatSummary;
const group = { kind: "group_chat" } as ChatSummary;
const channel = { kind: "channel" } as ChatSummary;

describe("the chat list filter", () => {
    test("All lets everything through", () => {
        expect([dm, group, channel].every((c) => passesChatListFilter(c, "all", 0))).toBe(true);
    });

    test("Direct is the direct chats, Groups the rest (a favourite channel too)", () => {
        expect(passesChatListFilter(dm, "direct", 0)).toBe(true);
        expect(passesChatListFilter(group, "direct", 0)).toBe(false);
        expect(passesChatListFilter(group, "groups", 0)).toBe(true);
        expect(passesChatListFilter(channel, "groups", 0)).toBe(true);
        expect(passesChatListFilter(dm, "groups", 0)).toBe(false);
    });

    test("Unread is the chats with unread messages", () => {
        expect(passesChatListFilter(dm, "unread", 2)).toBe(true);
        expect(passesChatListFilter(group, "unread", 0)).toBe(false);
    });

    test("a stored filter it doesn't know is All", () => {
        expect(chatListFilterFrom("unread")).toBe("unread");
        expect(chatListFilterFrom("favourites")).toBe("all");
    });
});
