import { describe, expect, test } from "vitest";
import {
    CALL_GROUP_WINDOW_MS,
    callEventProps,
    callLength,
    callMedia,
    callState,
    groupCalls,
    isLiveCall,
    timelineCallState,
    callRequest,
} from "./callItem";

const joined = [{ userId: "me", joined: 1n }];

describe("a call in the timeline", () => {
    test("is live until it ends, then ended for those in it and missed for the rest", () => {
        expect(callState({ ended: undefined, participants: [] }, "me")).toBe("live");
        expect(callState({ ended: 9n, participants: joined }, "me")).toBe("ended");
        expect(callState({ ended: 9n, participants: joined }, "you")).toBe("missed");
    });

    test("is voice only for an audio call", () => {
        expect(callMedia({ callType: "audio" })).toBe("voice");
        expect(callMedia({ callType: "default" })).toBe("video");
        expect(callMedia({ callType: "broadcast" })).toBe("video");
    });

    test("runs until it ends, or until now while it's live", () => {
        expect(callLength({ ended: 70_000n }, 10_000n, 99_000)).toBe(60_000);
        expect(callLength({ ended: undefined }, 10_000n, 25_000)).toBe(15_000);
        expect(callLength({ ended: undefined }, undefined, 25_000)).toBeUndefined();
    });

    test("is the chat's live call when its message is the one in progress", () => {
        expect(isLiveCall({ messageIndex: 4 }, 4)).toBe(true);
        expect(isLiveCall({ messageIndex: 4 }, 5)).toBe(false);
        expect(isLiveCall(undefined, 4)).toBe(false);
    });
});

describe("an ended or missed call", () => {
    test("the user's own reads as theirs, anyone else's by name", () => {
        expect(callEventProps("missed", "voice", { mine: true }, "", "10:00").startedBy).toBe(
            "You",
        );
        expect(
            callEventProps("ended", "video", { mine: false, name: "Ann" }, "4:12", "10:00"),
        ).toEqual({
            state: "ended",
            media: "video",
            startedBy: "Ann",
            duration: "4:12",
            time: "10:00",
        });
    });
});

describe("a call in the web timeline", () => {
    test("is live only while it's the chat's call in progress", () => {
        expect(timelineCallState({ ended: undefined, participants: [] }, "me", true)).toBe("live");
        expect(timelineCallState({ ended: 9n, participants: joined }, "me", true)).toBe("ended");
    });

    test("never said to have ended but no longer in progress, is over", () => {
        expect(timelineCallState({ ended: undefined, participants: joined }, "me", false)).toBe(
            "ended",
        );
        expect(timelineCallState({ ended: undefined, participants: [] }, "me", false)).toBe(
            "missed",
        );
    });
});

describe("runs of calls (web/05)", () => {
    const HOUR = 3_600_000n;
    type Item = { key: string; call?: bigint };
    const call = (item: Item) => (item.call === undefined ? undefined : { timestamp: item.call });
    // newest first, as the list has them
    const items: Item[] = [
        { key: "c4", call: 22n * HOUR },
        { key: "c3", call: 13n * HOUR },
        { key: "c2", call: 12n * HOUR },
        { key: "m1" },
        { key: "c1", call: 1n * HOUR },
    ];

    test("two or more calls in a row within 8h show as one item, the newest, with the run oldest first", () => {
        const grouped = groupCalls(items.slice(1), call);
        expect(grouped.items.map((i) => i.key)).toEqual(["c3", "m1", "c1"]);
        expect(grouped.runs.get("c3")?.map((i) => i.key)).toEqual(["c2", "c3"]);
        expect(grouped.runs.size).toBe(1);
    });

    test("a call more than 8h after the one before it starts a new run", () => {
        const grouped = groupCalls(items, call);
        expect(grouped.items.map((i) => i.key)).toEqual(["c4", "c3", "m1", "c1"]);
        expect(grouped.runs.has("c4")).toBe(false);
        expect(grouped.runs.get("c3")?.map((i) => i.key)).toEqual(["c2", "c3"]);
        expect(Number(CALL_GROUP_WINDOW_MS)).toBe(8 * 3_600_000);
    });

    test("anything between two calls (a message, a date) keeps them apart", () => {
        const apart = [items[2], { key: "date" }, items[4]];
        const grouped = groupCalls(apart, call);
        expect(grouped.runs.size).toBe(0);
        expect(grouped.items).toBe(apart);
    });

    test("a call that isn't over (the live one) is never grouped", () => {
        const live = new Set(["c3"]);
        const over = (item: Item) => (live.has(item.key) ? undefined : call(item));
        const grouped = groupCalls(items.slice(1), over);
        expect(grouped.runs.size).toBe(0);
    });
});

describe("pressing a call in the timeline", () => {
    // #10125: Join joins the call as the type it was started as, and Call back starts a new call
    // of the same type, or joins the one running in the chat by then
    test("Join joins, and Call back calls again or joins the call going on", () => {
        expect(callRequest("join", { callType: "audio" }, true)).toEqual({
            callType: "audio",
            join: true,
        });
        expect(callRequest("call_back", { callType: "audio" }, false)).toEqual({
            callType: "audio",
            join: false,
        });
        expect(callRequest("call_back", { callType: "default" }, true)).toEqual({
            callType: "default",
            join: true,
        });
    });
});
