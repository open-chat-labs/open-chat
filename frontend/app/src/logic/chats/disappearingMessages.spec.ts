import { describe, expect, test } from "vitest";
import {
    DISAPPEARING_DURATIONS,
    DISAPPEARING_START,
    disappearingChoices,
    disappearingChoicesWith,
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

    // native plan 10: "Default when first enabled: 1 day", the one default every screen on this
    // module starts at (the web's DM panel too, which started at the client's week, #10112)
    test("off reads as a day, the length they start at", () => {
        expect(DISAPPEARING_START).toBe("1 day");
        expect(ttlDurationId(undefined)).toBe(DISAPPEARING_START);
        expect(ttlDurationId(0n)).toBe(DISAPPEARING_START);
    });
});

describe("disappearingChoices", () => {
    test("offers the usual lengths for a chat on one of them, or off", () => {
        expect(disappearingChoices(undefined)).toEqual([...DISAPPEARING_DURATIONS]);
        expect(disappearingChoices(BigInt(86_400_000))).toEqual([...DISAPPEARING_DURATIONS]);
    });

    // set from another app: it shows, picked, among the others by length
    test("adds the chat's own length where it's another", () => {
        expect(disappearingChoices(BigInt(10 * 60_000))).toEqual([
            "5 minutes",
            "10 minutes",
            "15 minutes",
            "1 hour",
            "8 hours",
            "12 hours",
            "1 day",
            "1 week",
            "30 days",
        ]);
        expect(disappearingChoices(BigInt(2 * 86_400_000))).toEqual([
            "5 minutes",
            "15 minutes",
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

describe("disappearingChoicesWith", () => {
    test("the usual lengths for one of them, or for something that isn't a length", () => {
        expect(disappearingChoicesWith("8 hours")).toEqual([...DISAPPEARING_DURATIONS]);
        expect(disappearingChoicesWith("Always")).toEqual([...DISAPPEARING_DURATIONS]);
    });

    test("another length goes in among them by length", () => {
        expect(disappearingChoicesWith("2 hours").slice(2, 5)).toEqual([
            "1 hour",
            "2 hours",
            "8 hours",
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
