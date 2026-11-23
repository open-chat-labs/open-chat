import { MessageMap, type ChatEvent, type EventWrapper, type Message } from "@shared";
import DRange from "drange";
import { describe, expect, test } from "vitest";
import { mergeEventsAndLocalUpdatesWithRange } from "./chat";
import {
    closeGap,
    keptAfterResent,
    pastConfirmed,
    reorderAfterResent,
} from "./localMessageIndexes";

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

describe("whether a local message is still just past the chat's confirmed events", () => {
    test("it is when its index is past the latest confirmed", () => {
        expect(pastConfirmed(11, 10)).toBe(true);
    });

    test("it isn't once others have posted up to or past it (out of date)", () => {
        expect(pastConfirmed(10, 10)).toBe(false);
        expect(pastConfirmed(3, 10)).toBe(false);
    });

    test("it isn't when the chat isn't known", () => {
        expect(pastConfirmed(11, undefined)).toBe(false);
    });
});

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

describe("the failed messages written after one sent again and confirmed", () => {
    const at = (m: EventWrapper<Message>, timestamp: number): EventWrapper<Message> => ({
        ...m,
        timestamp: BigInt(timestamp),
    });
    // the chat up to 5; two messages written offline, both failed (M1 at 6, M2 at 7); meanwhile
    // the chat logged an event at 6 (the rules changing), so M1, sent again, is confirmed at 7
    const confirmed = [1, 2, 3, 4, 5].map((i) => message(i, i, `c${i}`));
    const m1 = at(message(6, 6, "M1"), 100);
    const m2 = at(message(7, 7, "M2"), 101);
    const rulesChanged = { ...message(6, 6, "rules"), timestamp: 90n };
    const m1Confirmed = at(message(7, 6, "M1"), 500);
    m1Confirmed.event.messageId = m1.event.messageId;

    test("left as they were, one shows above the one sent again, which took the time it went", () => {
        expect(shown([...confirmed, rulesChanged, m1Confirmed], [m2])).toEqual([
            "c1",
            "c2",
            "c3",
            "c4",
            "c5",
            "rules",
            "M2",
            "M1",
        ]);
    });

    test("retimed to just after it, they stay below it, in the order they were written", () => {
        const m3 = at(message(8, 8, "M3"), 102);
        const kept = keptAfterResent([m3, m2], m1.timestamp, m1Confirmed.timestamp);
        expect(kept.map((m) => m.timestamp)).toEqual([501n, 502n]);
        expect(shown([...confirmed, rulesChanged, m1Confirmed], kept)).toEqual([
            "c1",
            "c2",
            "c3",
            "c4",
            "c5",
            "rules",
            "M1",
            "M2",
            "M3",
        ]);
    });

    test("those written before it, or already after it, are left as they are", () => {
        const before = at(message(5, 5, "before"), 50);
        const later = at(message(9, 9, "later"), 600);
        expect(keptAfterResent([before, later], 100n, 500n)).toEqual([]);
    });
});

describe("a failed message sent again at the end, others having posted since", () => {
    const at = (m: EventWrapper<Message>, timestamp: number): EventWrapper<Message> => ({
        ...m,
        timestamp: BigInt(timestamp),
    });
    // the chat up to 5, then the rules changing at 6; M1 and M2 failed at 6 and 7 (out of date),
    // and M1 sent again now, given the next index after M2's
    const confirmed = [1, 2, 3, 4, 5].map((i) => message(i, i, `c${i}`));
    const rulesChanged = { ...message(6, 6, "rules"), timestamp: 90n };
    const m2 = at(message(7, 7, "M2"), 101);
    const m1Going = at(message(8, 8, "M1"), 500);

    test("left as they were, the later written shows above it", () => {
        expect(shown([...confirmed, rulesChanged], [m1Going, m2]).slice(-2)).toEqual(["M2", "M1"]);
    });

    test("put back in order, it takes the lower place and they follow, all showing", () => {
        const { resent, kept } = reorderAfterResent(m1Going, [m2], 100n);
        expect(resent.index).toBe(7);
        expect(resent.timestamp).toBe(500n);
        expect(kept.map((m) => [m.index, m.timestamp])).toEqual([[8, 501n]]);
        expect(shown([...confirmed, rulesChanged], [resent, ...kept]).slice(-3)).toEqual([
            "rules",
            "M1",
            "M2",
        ]);
    });

    test("sent again in its place (nothing written after it is earlier), nothing changes", () => {
        const inPlace = at(message(6, 6, "M1"), 100);
        const { resent, kept } = reorderAfterResent(inPlace, [m2], 100n);
        expect(resent).toBe(inPlace);
        expect(kept).toEqual([]);
    });
});
