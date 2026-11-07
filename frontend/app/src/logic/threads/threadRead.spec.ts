import type { ChatEvent, EventWrapper } from "@client";
import { describe, expect, test } from "vitest";
import { lastMessageIndex, threadReadOnSight } from "./threadRead";

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

describe("lastMessageIndex", () => {
    test("is the last message's, skipping other events", () => {
        expect(lastMessageIndex([reply(2), reply(5), other(6)])).toBe(5);
        expect(lastMessageIndex([other(1)])).toBeUndefined();
    });
});
