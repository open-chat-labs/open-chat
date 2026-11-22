import { MessageMap, type ChatEvent, type EventWrapper, type Message } from "@shared";
import DRange from "drange";
import { describe, expect, test } from "vitest";
import { mergeEventsAndLocalUpdatesWithRange } from "./chat";
import { closeGap } from "./localMessageIndexes";

function message(index: number, messageIndex: number, text: string): EventWrapper<Message> {
    return {
        index,
        timestamp: BigInt(index),
        expiresAt: undefined,
        event: {
            kind: "message",
            messageId: BigInt(1000 + index),
            messageIndex,
            content: { kind: "text_content", text },
            sender: "me",
            reactions: [],
            deleted: false,
            edited: false,
            forwarded: false,
            blockLevelMarkdown: false,
            tips: {},
            ogPreviews: [],
            messagePreviews: [],
        },
    };
}

// the texts the chat shows: its loaded events and the local messages that run on from them
function shown(events: EventWrapper<ChatEvent>[], local: EventWrapper<Message>[]): string[] {
    return mergeEventsAndLocalUpdatesWithRange(
        events,
        local,
        new DRange(),
        new MessageMap(),
        new Set(),
        new MessageMap(),
        new MessageMap(),
        [],
    ).events.map((e) =>
        e.event.kind === "message" && e.event.content.kind === "text_content"
            ? e.event.content.text
            : "",
    );
}

describe("closing the gap a deleted local message leaves", () => {
    test("one after it moves down a place, its message index too", () => {
        const after = message(5, 3, "two");
        expect(closeGap(after, { index: 4, messageIndex: 2 })).toMatchObject({
            index: 4,
            event: { messageIndex: 2 },
        });
    });

    test("one before it stays as it was", () => {
        const before = message(3, 1, "zero");
        expect(closeGap(before, { index: 4, messageIndex: 2 })).toBe(before);
    });

    test("deleting the first of two queued messages left the second out of the chat (#10591)", () => {
        const confirmed = message(1, 0, "hello");
        const second = message(3, 2, "two");
        // the first (2) deleted: the second no longer runs on from the chat
        expect(shown([confirmed], [second])).toEqual(["hello"]);
        // moved into its place, it shows
        expect(shown([confirmed], [closeGap(second, { index: 2, messageIndex: 1 })])).toEqual([
            "hello",
            "two",
        ]);
    });
});
