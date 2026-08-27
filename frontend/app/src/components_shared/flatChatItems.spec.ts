import type { ChatEvent, EventWrapper, Message, TimelineItem } from "@client";
import { describe, expect, test } from "vitest";
import { flattenTimeline, TimelineFlattener } from "./flatChatItems";

const BASE = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function msgEv(index: number, sender = "u1", ts = BASE + index * 1000): EventWrapper<Message> {
    return {
        index,
        timestamp: BigInt(ts),
        event: {
            kind: "message",
            messageId: BigInt(index),
            messageIndex: index,
            sender,
            content: { kind: "text_content", text: `m${index}` },
            reactions: [],
            tips: {},
            edited: false,
            forwarded: false,
            deleted: false,
            blockLevelMarkdown: false,
            ogPreviews: [],
            messagePreviews: [],
        },
    };
}

function timelineOf(...groups: EventWrapper<ChatEvent>[][][]): TimelineItem<ChatEvent>[] {
    const out: TimelineItem<ChatEvent>[] = [];
    for (const dayGroup of groups) {
        out.push(
            { kind: "timeline_event_group", group: dayGroup },
            { kind: "timeline_date", timestamp: dayGroup[0][0].timestamp },
        );
    }
    return out;
}

describe("TimelineFlattener", () => {
    const e1 = msgEv(1, "u1", BASE + DAY);
    const e2 = msgEv(2, "u1", BASE + DAY + 1);
    const e3 = msgEv(3, "u2", BASE + DAY + 2);
    const e4 = msgEv(4, "u1", BASE);

    test("matches flattenTimeline and always returns a new array", () => {
        const f = new TimelineFlattener();
        const tl = timelineOf([[e3], [e2, e1]], [[e4]]);
        const a = f.flatten(tl);
        expect(a).toEqual(flattenTimeline(tl));
        const b = f.flatten(tl);
        expect(b).toEqual(a);
        expect(b).not.toBe(a);
        b.forEach((item, i) => expect(item).toBe(a[i]));
    });

    test("reuses rows for untouched items and for unchanged wrappers in a patched group", () => {
        const f = new TimelineFlattener();
        const before = f.flatten(timelineOf([[e3], [e2, e1]], [[e4]]));
        const e2b = { ...e2 };
        const tl2 = timelineOf([[e3], [e2b, e1]], [[e4]]);
        const after = f.flatten(tl2);
        expect(after).toEqual(flattenTimeline(tl2));
        expect(after[0]).toBe(before[0]); // e3 row unchanged
        expect(after[1]).not.toBe(before[1]); // e2 replaced
        expect(after[1].kind === "event" && after[1].event).toBe(e2b);
        expect(after[2]).toBe(before[2]); // e1 unchanged
        expect(after[3]).not.toBe(before[3]); // date: new object in tl2 (same key/timestamp)
        expect(after[4]).toBe(before[4]); // e4 group is a new object of same shape → row reused
    });

    test("identical timeline items copy their rows through", () => {
        const f = new TimelineFlattener();
        const tl = timelineOf([[e3], [e2, e1]], [[e4]]);
        const before = f.flatten(tl);
        const tl2 = [...tl];
        const after = f.flatten(tl2);
        after.forEach((item, i) => expect(item).toBe(before[i]));
    });

    test("shape changes rebuild rows correctly", () => {
        const f = new TimelineFlattener();
        f.flatten(timelineOf([[e3], [e2, e1]], [[e4]]));
        const e0 = msgEv(0, "u2", BASE + DAY + 3);
        const cases = [
            timelineOf(
                [
                    [e0, e3],
                    [e2, e1],
                ],
                [[e4]],
            ),
            timelineOf([[e2, e1]], [[e4]]),
            timelineOf([[e3, e2, e1]], [[e4]]),
            timelineOf([[e4]]),
            [],
        ];
        for (const tl of cases) {
            expect(f.flatten(tl)).toEqual(flattenTimeline(tl));
        }
    });
});
