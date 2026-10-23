import { allChitEvents, currentStreak, dailyChitClaimable } from "./chit";

describe("the current streak", () => {
    test("is the streak until it ends", () => {
        expect(currentStreak({ streak: 7, streakEnds: 2000n }, 1000)).toBe(7);
    });

    test("is none once it has ended", () => {
        expect(currentStreak({ streak: 7, streakEnds: 2000n }, 3000)).toBe(0);
    });
});

describe("all the CHIT events", () => {
    const event = (timestamp: number) => ({
        amount: 1,
        timestamp: BigInt(timestamp),
        reason: { kind: "daily_claim" as const },
    });

    test("are read a page at a time, each from just after the last one read, until a short page", async () => {
        const stored = [1, 2, 3, 4, 5].map(event);
        const page = vi.fn(async (from: bigint, max: number) =>
            stored.filter((e) => e.timestamp >= from).slice(0, max),
        );
        expect(await allChitEvents(page, 0n, 2)).toEqual(stored);
        expect(page.mock.calls.map(([from]) => from)).toEqual([0n, 3n, 5n]);
    });

    test("stop after the page bound", async () => {
        const page = vi.fn(async (from: bigint) => [event(Number(from)), event(Number(from) + 1)]);
        expect(await allChitEvents(page, 0n, 2, 3)).toHaveLength(6);
        expect(page).toHaveBeenCalledTimes(3);
    });
});

describe("whether today's CHIT can be claimed", () => {
    test("once the next claim's time has come", () => {
        expect(dailyChitClaimable(2000n, 1000)).toBe(false);
        expect(dailyChitClaimable(2000n, 3000)).toBe(true);
    });

    test("and, given the last sync, only while that's under 10 minutes old", () => {
        const now = 60 * 60_000;
        expect(dailyChitClaimable(0n, now, now - 9 * 60_000)).toBe(true);
        expect(dailyChitClaimable(0n, now, now - 11 * 60_000)).toBe(false);
    });
});
