import { describe, expect, test } from "vitest";
import { withLatestUserIds } from "./latestUserIds";

const OLD = "rrkah-fqaaa-aaaaa-aaaaq-cai";
const NEW = "dfdal-2uaaa-aaaaa-qaama-cai";
const OTHER = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const latest = new Map([[OLD, NEW]]);

describe("withLatestUserIds", () => {
    test("replaces an earlier id wherever it is held", () => {
        const event = {
            sender: OLD,
            mentions: [OLD, OTHER],
            reactions: [{ reaction: "👍", userIds: new Set([OLD, OTHER]) }],
            tips: { ledger: { [OLD]: 10n, [OTHER]: 5n } },
            participants: new Map([[OLD, { joined: 1n }]]),
            repliesTo: { senderId: OLD, content: { kind: "text_content", text: "hi" } },
        };

        expect(withLatestUserIds(event, latest)).toEqual({
            sender: NEW,
            mentions: [NEW, OTHER],
            reactions: [{ reaction: "👍", userIds: new Set([NEW, OTHER]) }],
            tips: { ledger: { [NEW]: 10n, [OTHER]: 5n } },
            participants: new Map([[NEW, { joined: 1n }]]),
            repliesTo: { senderId: NEW, content: { kind: "text_content", text: "hi" } },
        });
    });

    test("copies from the first change, keeping what comes before and after it in order", () => {
        const before = { kind: "text_content", text: "before" };
        const after = { kind: "text_content", text: "after" };
        const list = [before, OLD, after];
        const set = new Set([OTHER, OLD, "x"]);
        const map = new Map<string, unknown>([
            ["a", before],
            [OLD, 1n],
            ["b", after],
        ]);
        const record = { a: before, sender: OLD, b: after };

        const replacedList = withLatestUserIds(list, latest);
        expect(replacedList).toEqual([before, NEW, after]);
        expect(replacedList[0]).toBe(before);
        expect(replacedList[2]).toBe(after);
        expect([...withLatestUserIds(set, latest)]).toEqual([OTHER, NEW, "x"]);
        expect([...withLatestUserIds(map, latest)]).toEqual([
            ["a", before],
            [NEW, 1n],
            ["b", after],
        ]);
        const replacedRecord = withLatestUserIds(record, latest);
        expect(Object.keys(replacedRecord)).toEqual(["a", "sender", "b"]);
        expect(replacedRecord).toEqual({ a: before, sender: NEW, b: after });
        expect(replacedRecord.a).toBe(before);
        expect(list).toEqual([before, OLD, after]);
    });

    test("leaves anything other than plain data as it is", () => {
        const bytes = new Uint8Array([1, 2, 3]);
        const date = new Date(0);
        const event = { bytes, date, count: 3, missing: undefined, nothing: null };

        expect(withLatestUserIds(event, latest)).toBe(event);
    });

    test("holds an id once where it held both the earlier and the current id", () => {
        const participants = new Set([OLD, NEW, OTHER]);

        expect(withLatestUserIds(participants, latest)).toEqual(new Set([NEW, OTHER]));
    });

    test("adds together tips keyed by both the earlier and the current id", () => {
        const tips = { ledger: { [OLD]: 100n, [NEW]: 50n, [OTHER]: 5n } };
        const tipsMap = new Map([
            [NEW, 50n],
            [OLD, 100n],
        ]);

        // The current id first, so the copy only starts at the earlier one
        const currentFirst = { [OTHER]: 5n, [NEW]: 50n, [OLD]: 100n };

        expect(withLatestUserIds(tips, latest)).toEqual({ ledger: { [NEW]: 150n, [OTHER]: 5n } });
        expect(withLatestUserIds(tipsMap, latest)).toEqual(new Map([[NEW, 150n]]));
        expect(withLatestUserIds(currentFirst, latest)).toEqual({ [OTHER]: 5n, [NEW]: 150n });
    });

    test("leaves text the user wrote as it is", () => {
        const content = { kind: "text_content", text: OLD };
        const image = { kind: "image_content", caption: OLD };

        expect(withLatestUserIds(content, latest)).toBe(content);
        expect(withLatestUserIds(image, latest)).toBe(image);
    });
});
