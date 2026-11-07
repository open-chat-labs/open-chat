import { describe, expect, test } from "vitest";
import { callLength, callMedia, callState, isLiveCall } from "./callItem";

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
