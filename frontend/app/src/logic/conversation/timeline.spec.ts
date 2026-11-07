import type { ChatIdentifier } from "@client";
import { describe, expect, test, vi } from "vitest";
import { FirstUnread, MessageLink, othersTyping } from "./timeline";

const group = (groupId: string): ChatIdentifier => ({ kind: "group_chat", groupId });

describe("the first unread message", () => {
    test("is worked out once per chat, so reading doesn't move the divider", () => {
        const first = new FirstUnread();
        const ask = vi.fn(() => 5);
        expect(first.of(group("a"), ask)).toBe(5);
        expect(first.of(group("a"), () => 9)).toBe(5);
        expect(ask).toHaveBeenCalledTimes(1);
    });

    test("is worked out again for another chat, never showing the last one's", () => {
        const first = new FirstUnread();
        first.of(group("a"), () => 5);
        expect(first.of(group("b"), () => undefined)).toBeUndefined();
        expect(first.of(group("a"), () => 7)).toBe(7);
    });
});

describe("the route's message", () => {
    test("is gone to once the chats have loaded, and not again while it stays the same", () => {
        const link = new MessageLink();
        expect(link.next(group("a"), 4, false)).toBeUndefined();
        // the chats load: the same link counts as already seen (as the old list's)
        expect(link.next(group("a"), 4, true)).toBeUndefined();
        expect(link.next(group("a"), 6, true)).toBe(6);
        expect(link.next(group("a"), 6, true)).toBeUndefined();
    });

    test("is gone to again when the chat changes, and never without one", () => {
        const link = new MessageLink();
        expect(link.next(group("a"), 4, true)).toBe(4);
        expect(link.next(group("b"), 4, true)).toBe(4);
        expect(link.next(group("b"), undefined, true)).toBeUndefined();
        expect(link.next(undefined, 3, true)).toBeUndefined();
    });
});

describe("who is typing", () => {
    test("leaves the user out and names the others", () => {
        const names: Record<string, string> = { a: "Ann", b: "Ben" };
        expect(othersTyping(new Set(["a", "me", "b"]), "me", (id) => names[id])).toEqual([
            "Ann",
            "Ben",
        ]);
        expect(othersTyping(undefined, "me", (id) => id)).toEqual([]);
    });
});
