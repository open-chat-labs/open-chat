import { durationMs } from "@openchat/ui/src/features/components/DmChatSettings.svelte";
import { describe, expect, test } from "vitest";
import { ttlDurationId } from "./disappearingMessages";

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
