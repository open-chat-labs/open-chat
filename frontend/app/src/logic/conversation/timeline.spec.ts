import { ROLE_MEMBER, ROLE_NONE, type ChatIdentifier, type ChatSummary } from "@client";
import { describe, expect, test, vi } from "vitest";
import {
    FirstUnread,
    firstUnreadOnOpen,
    MessageLink,
    OpenAtUnread,
    othersTyping,
    typingPlacement,
} from "./timeline";

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

describe("a chat's first unread message as it opens", () => {
    const chat = (role: number) =>
        ({
            id: group("a"),
            membership: { role },
            latestMessage: { event: { messageIndex: 62 } },
        }) as ChatSummary;

    test("is the read state's, up to the latest message", () => {
        const ask = vi.fn(() => 40);
        expect(firstUnreadOnOpen(chat(ROLE_MEMBER), ask)).toBe(40);
        expect(ask).toHaveBeenCalledWith(group("a"), 62);
    });

    // previewing a channel opened it at its very first message, under the divider
    test("is none while previewing, where nothing has been read", () => {
        expect(firstUnreadOnOpen(chat(ROLE_NONE), () => 0)).toBeUndefined();
    });
});

describe("the unread divider, once everything after it is read", () => {
    test("goes for the rest of the visit", () => {
        const first = new FirstUnread();
        expect(first.of(group("a"), () => 5)).toBe(5);
        first.seen(group("a"));
        expect(first.of(group("a"), () => 5)).toBeUndefined();
    });

    test("stays when it's another chat that was read", () => {
        const first = new FirstUnread();
        first.of(group("a"), () => 5);
        first.seen(group("b"));
        expect(first.of(group("a"), () => 9)).toBe(5);
    });

    test("is back on the next visit, if there's something unread then", () => {
        const first = new FirstUnread();
        first.of(group("a"), () => 5);
        first.seen(group("a"));
        first.of(group("b"), () => undefined);
        expect(first.of(group("a"), () => 12)).toBe(12);
    });

    test("goes once the chat is selected and nothing is left unread", () => {
        expect(FirstUnread.readThrough(5, true, () => 0)).toBe(true);
        expect(FirstUnread.readThrough(5, true, () => 2)).toBe(false);
    });

    // the screen still shows the chat while it leaves, or while another chat is opened over it
    // (a quote, a link, a notification): nothing was read then
    test("stays while the chat isn't selected, without asking what's unread", () => {
        const unreadLeft = vi.fn(() => 0);
        expect(FirstUnread.readThrough(5, false, unreadLeft)).toBe(false);
        expect(unreadLeft).not.toHaveBeenCalled();
    });

    test("has nothing to go when there's no divider", () => {
        expect(FirstUnread.readThrough(undefined, true, () => 0)).toBe(false);
    });
});

describe("a chat opened with unread messages", () => {
    const has = (indexes: number[]) => (i: number) => indexes.includes(i);

    test("goes to the first unread once it's among the list's messages, and only once", () => {
        const open = new OpenAtUnread();
        expect(open.next(group("a"), 8, undefined, has([20, 21]))).toBeUndefined();
        expect(open.next(group("a"), 8, undefined, has([7, 8, 9]))).toBe(8);
        expect(open.next(group("a"), 8, undefined, has([7, 8, 9]))).toBeUndefined();
    });

    test("leaves a link to go to its own message, and a chat with nothing unread at the bottom", () => {
        const open = new OpenAtUnread();
        expect(open.next(group("a"), 8, 3, has([3, 8]))).toBeUndefined();
        expect(open.next(group("a"), 8, undefined, has([8]))).toBeUndefined();
        expect(open.next(group("b"), undefined, undefined, has([1]))).toBeUndefined();
    });

    test("goes again for another chat", () => {
        const open = new OpenAtUnread();
        expect(open.next(group("a"), 8, undefined, has([8]))).toBe(8);
        expect(open.next(group("b"), 2, undefined, has([2]))).toBe(2);
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

describe("where who's typing shows", () => {
    test("is a bubble at the end of a DM's messages", () => {
        expect(typingPlacement("direct_chat", undefined)).toBe("bubble");
    });

    test("is the strip on the composer in a group or channel", () => {
        expect(typingPlacement("group_chat", undefined)).toBe("strip");
        expect(typingPlacement("channel", undefined)).toBe("strip");
    });

    test("is the strip in a thread, a DM's too", () => {
        expect(typingPlacement("group_chat", 4)).toBe("strip");
        expect(typingPlacement("direct_chat", 0)).toBe("strip");
    });

    test("is the strip in a DM until its latest messages are loaded", () => {
        expect(typingPlacement("direct_chat", undefined, true)).toBe("strip");
        expect(typingPlacement("direct_chat", undefined, false)).toBe("bubble");
        expect(typingPlacement("group_chat", undefined, false)).toBe("strip");
    });
});
