import { describe, expect, test } from "vitest";
import { nextSendAllowedAt, sendsLeft, trySend } from "./throttling";

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

describe("the next send allowed", () => {
    const now = 1_000_000;
    const full = (from: number) => Array.from({ length: 10 }, (_, i) => from + i * 1000);

    test("is now while the limit leaves room", () => {
        expect(nextSendAllowedAt(now, false, [])).toBe(now);
        expect(nextSendAllowedAt(now, false, full(now - 9_000).slice(1))).toBe(now);
    });

    test("is once the oldest send in the window has left it, when it's full", () => {
        expect(nextSendAllowedAt(now, false, full(now - 30_000))).toBe(now - 30_000 + 60_001);
    });

    test("leaves room for one more when there are more than the limit (times out of order)", () => {
        const times = [...full(now - 30_000), now - 50_000, now - 40_000].reverse();
        // three of the 12 must leave before there's room: the oldest of the full ten is the last
        expect(nextSendAllowedAt(now, false, times)).toBe(now - 30_000 + 60_001);
    });

    test("doesn't count sends more than a minute ago", () => {
        expect(nextSendAllowedAt(now, false, full(now - 70_000))).toBe(now);
    });

    test("a diamond member has twice the room", () => {
        expect(nextSendAllowedAt(now, true, full(now - 30_000))).toBe(now);
    });
});

describe("a send tried", () => {
    const now = 1_000_000;
    const full = Array.from({ length: 10 }, (_, i) => now - 30_000 + i);

    test("allowed, counts in the window", () => {
        const attempt = trySend(now, false, full.slice(1));
        expect(attempt.allowed).toBe(true);
        expect(attempt.times).toEqual([...full.slice(1), now]);
    });

    test("refused, doesn't count, and says when the next send is (#10595)", () => {
        expect(trySend(now, false, full)).toEqual({
            allowed: false,
            times: full,
            nextAllowedAt: full[0] + 60_001,
        });
    });

    test("refused however often it's tried, the window still clears on time", () => {
        let times = full;
        for (let t = now; t < full[0] + 60_001; t += 5_000) {
            const attempt = trySend(t, false, times);
            expect(attempt.allowed).toBe(false);
            times = attempt.times;
        }
        expect(trySend(full[0] + 60_001, false, times).allowed).toBe(true);
    });

    test("drops the times that have left the window", () => {
        expect(trySend(now, false, [now - 60_001, now - 1]).times).toEqual([now - 1, now]);
    });
});
