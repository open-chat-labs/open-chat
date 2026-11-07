import type { ChatEvent, ChatSummary, EventWrapper } from "@client";
import { describe, expect, test, vi } from "vitest";
import { lastMessageIndex, threadReadOnSight, threadUnreadCount } from "./threadRead";

function reply(messageIndex: number): EventWrapper<ChatEvent> {
    return {
        index: messageIndex,
        timestamp: 1n,
        event: { kind: "message", messageIndex },
    } as EventWrapper<ChatEvent>;
}

function other(index: number): EventWrapper<ChatEvent> {
    return {
        index,
        timestamp: 1n,
        event: { kind: "empty" },
    } as EventWrapper<ChatEvent>;
}

describe("threadReadOnSight", () => {
    const latest = [reply(7), reply(8), reply(9)];

    test("4c invariant 6: marks read up to the last reply when every unread reply is on screen", () => {
        expect(threadReadOnSight(1, latest)).toBe(9);
        expect(threadReadOnSight(3, latest)).toBe(9);
    });

    test("4c invariant 6: not while some unread replies aren't among those shown", () => {
        expect(threadReadOnSight(4, latest)).toBeUndefined();
    });

    test("nothing to mark with nothing unread", () => {
        expect(threadReadOnSight(0, latest)).toBeUndefined();
    });
});

describe("threadUnreadCount", () => {
    const chat = {
        kind: "group_chat",
        membership: {
            latestThreads: [
                {
                    threadRootMessageIndex: 4,
                    lastUpdated: 1n,
                    latestEventIndex: 8,
                    latestMessageIndex: 7,
                },
            ],
        },
    } as unknown as ChatSummary;

    test("counts up to the thread's latest message as the chat's sync last said", () => {
        const unread = vi.fn((latest: number) => latest - 5);
        expect(threadUnreadCount(chat, 4, unread)).toBe(2);
        expect(unread).toHaveBeenCalledWith(7);
    });

    test("4c invariant 2: a thread the chat doesn't list as followed has nothing unread", () => {
        expect(threadUnreadCount(chat, 5, () => 3)).toBe(0);
        expect(threadUnreadCount(undefined, 4, () => 3)).toBe(0);
    });
});

describe("lastMessageIndex", () => {
    test("is the last message's, skipping other events", () => {
        expect(lastMessageIndex([reply(2), reply(5), other(6)])).toBe(5);
        expect(lastMessageIndex([other(1)])).toBeUndefined();
    });
});
