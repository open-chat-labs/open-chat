import { describe, expect, test } from "vitest";
import {
    DISAPPEARING_DURATIONS,
    disappearingChoices,
    durationMs,
    durationParts,
    ttlDurationId,
} from "./disappearingMessages";

describe("ttlDurationId", () => {
    // a TTL read into a settings panel and saved back must be the same length of time
    test("reads a TTL as a duration that converts back to the same milliseconds", () => {
        for (const ms of [
            3_600_000,
            8 * 3_600_000,
            86_400_000,
            604_800_000,
            30 * 86_400_000,
            90 * 60_000,
        ]) {
            expect(durationMs(ttlDurationId(BigInt(ms)))).toBe(ms);
        }
    });

    // #10112: turned on, disappearing messages start at a week
    test("off reads as a week, the length they start at", () => {
        expect(ttlDurationId(undefined)).toBe("1 week");
    });
});

describe("disappearingChoices", () => {
    test("offers the usual lengths for a chat on one of them, or off", () => {
        expect(disappearingChoices(undefined)).toEqual([...DISAPPEARING_DURATIONS]);
        expect(disappearingChoices(BigInt(86_400_000))).toEqual([...DISAPPEARING_DURATIONS]);
    });

    // set from another app: it shows, picked, among the others by length
    test("adds the chat's own length where it's another", () => {
        expect(disappearingChoices(BigInt(5 * 60_000))).toEqual([
            "5 minutes",
            ...DISAPPEARING_DURATIONS,
        ]);
        expect(disappearingChoices(BigInt(2 * 86_400_000))).toEqual([
            "1 hour",
            "8 hours",
            "12 hours",
            "1 day",
            "2 days",
            "1 week",
            "30 days",
        ]);
    });
});

describe("durationParts", () => {
    test("reads a duration id's unit and count", () => {
        expect(durationParts("8 hours")).toEqual({ unit: "hour", count: 8 });
        expect(durationParts("1 week")).toEqual({ unit: "week", count: 1 });
        expect(durationParts("90 minutes")).toEqual({ unit: "minute", count: 90 });
        expect(durationParts("Always")).toBeUndefined();
    });

    // what's offered reads as words: every length has a unit the app has words for
    test("reads every length offered", () => {
        for (const id of DISAPPEARING_DURATIONS) {
            expect(durationParts(id)).toBeDefined();
        }
    });
});
