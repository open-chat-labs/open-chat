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

    test("returns whatever holds no earlier id as it was", () => {
        const content = { kind: "text_content", text: "hi" };
        const event = { sender: OLD, content, reactions: new Set([OTHER]) };

        const replaced = withLatestUserIds(event, latest);

        expect(replaced).not.toBe(event);
        expect(replaced.content).toBe(content);
        expect(replaced.reactions).toBe(event.reactions);
        expect(withLatestUserIds(content, latest)).toBe(content);
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

        expect(withLatestUserIds(tips, latest)).toEqual({ ledger: { [NEW]: 150n, [OTHER]: 5n } });
        expect(withLatestUserIds(tipsMap, latest)).toEqual(new Map([[NEW, 150n]]));
    });

    test("leaves text the user wrote as it is", () => {
        const content = { kind: "text_content", text: OLD };
        const image = { kind: "image_content", caption: OLD };

        expect(withLatestUserIds(content, latest)).toBe(content);
        expect(withLatestUserIds(image, latest)).toBe(image);
    });

    test("does nothing when there are no earlier ids", () => {
        const event = { sender: OLD };

        expect(withLatestUserIds(event, new Map())).toBe(event);
    });
});
