import type { EventWrapper, Message, MessageContent, UserLookup } from "@client";
import type { PreviewText } from "@src/logic/chats/latestMessagePreview";
import { describe, expect, test, vi } from "vitest";

// messages are restricted only in the app store build; here any moderation flag restricts
vi.mock("@client", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    messageFlagsRestricted: (flags: number | undefined) => (flags ?? 0) !== 0,
}));
import {
    firstLine,
    nextPin,
    offersUnpinAll,
    pinnedMenuActions,
    shownDays,
    stripBar,
    stripCurrent,
    stripLine,
    stripOrder,
    unpinAllIndexes,
    unpinKey,
} from "./pinned.adapter";

const none = () => false;

describe("the strip's pins", () => {
    test("go newest first, without those waiting to be unpinned", () => {
        expect(stripOrder(new Set([3, 12, 7]), none)).toEqual([12, 7, 3]);
        expect(stripOrder([3, 12, 7], (i) => i === 12)).toEqual([7, 3]);
        expect(stripOrder([], none)).toEqual([]);
    });

    test("keep the pin shown while it's pinned, else show the newest", () => {
        expect(stripCurrent([12, 7, 3], 7)).toBe(7);
        expect(stripCurrent([12, 3], 7)).toBe(12);
        expect(stripCurrent([12, 3], undefined)).toBe(12);
        expect(stripCurrent([], 7)).toBeUndefined();
    });

    test("move on to the next older pin, round to the newest after the oldest", () => {
        expect(nextPin([12, 7, 3], 12)).toBe(7);
        expect(nextPin([12, 7, 3], 3)).toBe(12);
        expect(nextPin([12], 12)).toBe(12);
        // one unpinned meanwhile: the newest
        expect(nextPin([12, 7], 9)).toBe(12);
        expect(nextPin([], 9)).toBeUndefined();
    });

    test("have a bar segment each, four at most, the last staying current past the fourth", () => {
        expect(stripBar(1, 0)).toEqual({ segments: 1, active: 0 });
        expect(stripBar(3, 2)).toEqual({ segments: 3, active: 2 });
        expect(stripBar(6, 1)).toEqual({ segments: 4, active: 1 });
        expect(stripBar(6, 5)).toEqual({ segments: 4, active: 3 });
    });

    test("show a message's first line that has something on it", () => {
        expect(firstLine("Hello\nthere")).toBe("Hello");
        expect(firstLine("\n  \n  Book club  \nmore")).toBe("Book club");
        expect(firstLine("")).toBe("");
    });

    test("show their author, escaped, and the first line as the chat list previews it", () => {
        expect(stripLine(message("bob", "Hello *all*\nmore"), names)).toBe("bob: Hello *all*");
        expect(stripLine(message("me", "Hi"), names)).toBe("You: Hi");
        // a name with markdown in it shows as it is
        expect(stripLine(message("*ann_*", "Hi"), names)).toBe("&#42;ann&#95;&#42;: Hi");
    });

    test("show restricted content as such, and the reader's translation", () => {
        expect(stripLine(message("bob", "secret", { flags: 1 }), names)).toBe(
            "bob: restricted_content",
        );
        expect(stripLine(message("bob", "Hello", { id: 9n }), names)).toBe("bob: Bonjour");
        // restricted wins over a translation
        expect(stripLine(message("bob", "Hello", { id: 9n, flags: 1 }), names)).toBe(
            "bob: restricted_content",
        );
    });

    test("are kept apart per chat while they wait", () => {
        expect(unpinKey("g1", 4)).not.toBe(unpinKey("g2", 4));
        expect(unpinKey("g1", 4)).not.toBe(unpinKey("g1", 5));
    });
});

const names: PreviewText = {
    formatter: (key) => key,
    me: "me",
    displayName: (id, kind) => (kind === "me" ? "You" : id),
    translations: new Map([[9n, "Bonjour"]]),
    contentText: (content: MessageContent) =>
        content.kind === "text_content" ? content.text : content.kind,
    bridgedUsers: new Map(),
    users: new Map() as UserLookup,
};

function message(sender: string, text: string, { id = 1n, flags = 0 } = {}): Message {
    return {
        messageId: id,
        sender,
        content: { kind: "text_content", text },
        moderationFlags: flags,
    } as Message;
}

function evt(messageIndex: number): EventWrapper<Message> {
    return { event: { messageIndex } } as EventWrapper<Message>;
}

describe("the Pinned messages screen", () => {
    test("leaves out the pins waiting to be unpinned, and a day left with none", () => {
        const days = [[evt(1), evt(2)], [evt(5)], [evt(8), evt(9)]];
        const shown = shownDays(days, (i) => i === 5 || i === 8);
        expect(shown.map((day) => day.map((e) => e.event.messageIndex))).toEqual([[1, 2], [9]]);
    });

    test("unpins every pin in the set with Unpin all, the ones that didn't load too", () => {
        // 4 didn't load (deleted, out of reach); 9 is already waiting to be unpinned
        expect(unpinAllIndexes(new Set([1, 4, 9]), (i) => i === 9).sort()).toEqual([1, 4]);
        expect(unpinAllIndexes([], () => false)).toEqual([]);
    });

    test("offers Unpin all to those who can pin, with two pins or more", () => {
        expect(offersUnpinAll(true, 2)).toBe(true);
        expect(offersUnpinAll(true, 1)).toBe(false);
        expect(offersUnpinAll(false, 5)).toBe(false);
    });

    test("offers Unpin in a pin's menu only to those who can pin", () => {
        expect(pinnedMenuActions(true)).toEqual(["go_to", "unpin"]);
        expect(pinnedMenuActions(false)).toEqual(["go_to"]);
    });
});
