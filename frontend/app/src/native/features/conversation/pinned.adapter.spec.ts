import type { EventWrapper, Message } from "@client";
import { describe, expect, test } from "vitest";
import {
    firstLine,
    nextPin,
    offersUnpinAll,
    pinnedMenuActions,
    shownDays,
    stripBar,
    stripCurrent,
    stripOrder,
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

    test("are kept apart per chat while they wait", () => {
        expect(unpinKey("g1", 4)).not.toBe(unpinKey("g2", 4));
        expect(unpinKey("g1", 4)).not.toBe(unpinKey("g1", 5));
    });
});

function evt(messageIndex: number): EventWrapper<Message> {
    return { event: { messageIndex } } as EventWrapper<Message>;
}

describe("the Pinned messages screen", () => {
    test("leaves out the pins waiting to be unpinned, and a day left with none", () => {
        const days = [[evt(1), evt(2)], [evt(5)], [evt(8), evt(9)]];
        const shown = shownDays(days, (i) => i === 5 || i === 8);
        expect(shown.map((day) => day.map((e) => e.event.messageIndex))).toEqual([[1, 2], [9]]);
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
