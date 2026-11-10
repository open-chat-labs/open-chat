import { describe, expect, test } from "vitest";
import { sendsLeft } from "./throttling";

describe("the sends left before the throttle", () => {
    const now = 1_000_000;

    test("are the minute's limit, less those sent in the last minute", () => {
        expect(sendsLeft(now, false, [])).toBe(10);
        expect(sendsLeft(now, true, [])).toBe(20);
        expect(sendsLeft(now, false, [now - 1000, now - 60_000])).toBe(8);
    });

    test("don't count those sent more than a minute ago", () => {
        expect(sendsLeft(now, false, [now - 60_001, now - 120_000])).toBe(10);
    });

    test("are none, never fewer, once the limit is reached", () => {
        expect(
            sendsLeft(
                now,
                false,
                Array.from({ length: 12 }, () => now),
            ),
        ).toBe(0);
    });
});
