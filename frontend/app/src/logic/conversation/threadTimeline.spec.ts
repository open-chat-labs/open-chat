import type { ChatEvent, EventWrapper, Message } from "@client";
import { describe, expect, test } from "vitest";
import {
    followsThread,
    rowMessageContext,
    threadEventReadByMe,
    threadRootIndexFor,
    threadTimelineEvents,
} from "./threadTimeline";

function message(index: number, messageId: bigint): EventWrapper<Message> {
    return {
        index,
        timestamp: 1n,
        event: {
            kind: "message",
            messageId,
            messageIndex: index,
            sender: "alice",
            content: { kind: "text_content", text: "hi" },
            reactions: [],
            tips: {},
            edited: false,
            forwarded: false,
            deleted: false,
            blockLevelMarkdown: false,
            ogPreviews: [],
            messagePreviews: [],
        },
    } as unknown as EventWrapper<Message>;
}

const root = message(40, 400n);
const replies = (...indexes: number[]): EventWrapper<ChatEvent>[] =>
    indexes.map((i) => message(i, BigInt(i)));

describe("threadTimelineEvents", () => {
    test("4c invariant 3: the root heads the replies only once they're loaded back to index 0", () => {
        expect(threadTimelineEvents(root, replies(0, 1, 2))).toEqual([root, ...replies(0, 1, 2)]);
        // a long thread still paging back doesn't show its root yet
        expect(threadTimelineEvents(root, replies(5, 6))).toEqual(replies(5, 6));
    });

    test("4c invariant 3: the root is shown once only", () => {
        const withRoot = [root, ...replies(0, 1)];
        expect(threadTimelineEvents(root, withRoot)).toBe(withRoot);
    });

    test("a thread with no replies loaded yet shows its root", () => {
        expect(threadTimelineEvents(root, [])).toEqual([root]);
    });

    test("a root gone from the chat's events (the window replaced) leaves the replies", () => {
        const loaded = replies(0, 1);
        expect(threadTimelineEvents(undefined, loaded)).toBe(loaded);
    });
});

describe("followsThread", () => {
    const summary = (followedByMe: boolean) =>
        ({
            participantIds: new Set<string>(),
            followedByMe,
            numberOfReplies: 1,
            latestEventIndex: 0,
            latestEventTimestamp: 1n,
        }) satisfies Message["thread"];

    test("goes by the root's thread summary, which a follow updates at once", () => {
        expect(followsThread({ messageIndex: 4, thread: summary(false) }, new Set([4]))).toBe(false);
        expect(followsThread({ messageIndex: 4, thread: summary(true) }, new Set<number>())).toBe(true);
    });

    test("without a summary yet, goes by the chat's followed threads", () => {
        expect(followsThread({ messageIndex: 4, thread: undefined }, new Set([4]))).toBe(true);
        expect(followsThread({ messageIndex: 4, thread: undefined }, undefined)).toBe(false);
    });
});

describe("threadEventReadByMe", () => {
    const reply = message(3, 3n);

    test("4c invariant 2: a reply in a thread the reader doesn't follow is never unread", () => {
        expect(threadEventReadByMe(reply, root.event.messageId, false, false)).toBe(true);
    });

    test("a reply in a followed thread is read when the reader has read it", () => {
        expect(threadEventReadByMe(reply, root.event.messageId, true, false)).toBe(false);
        expect(threadEventReadByMe(reply, root.event.messageId, true, true)).toBe(true);
    });

    test("the root always counts as read", () => {
        expect(threadEventReadByMe(root, root.event.messageId, true, false)).toBe(true);
    });

    test("without a root, an unread reply in a followed thread stays unread", () => {
        expect(threadEventReadByMe(reply, undefined, true, false)).toBe(false);
    });
});

describe("where a row's message is (its actions' context)", () => {
    const chatId = { kind: "group_chat" as const, groupId: "g" };
    const reply = message(3, 3n);

    test("in a thread, the root is the chat's message: its actions go to the chat", () => {
        expect(threadRootIndexFor(root.event, root.event)).toBeUndefined();
        expect(rowMessageContext(chatId, root.event, root.event)).toStrictEqual({ chatId });
    });

    test("in a thread, a reply's actions go to the thread", () => {
        expect(threadRootIndexFor(root.event, reply.event)).toBe(40);
        expect(rowMessageContext(chatId, root.event, reply.event)).toStrictEqual({
            chatId,
            threadRootMessageIndex: 40,
        });
    });

    test("outside a thread, every message's actions go to the chat", () => {
        expect(threadRootIndexFor(undefined, reply.event)).toBeUndefined();
        expect(rowMessageContext(chatId, undefined, reply.event)).toStrictEqual({ chatId });
    });
});
