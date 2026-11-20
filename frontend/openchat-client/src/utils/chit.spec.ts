import {
    allChitEvents,
    CHIT_STREAK_MILESTONES,
    currentStreak,
    dailyChitAmount,
    dailyChitClaimable,
    mergeChitEvents,
    newestFirstChitEvents,
    streakRingProgress,
} from "./chit";

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
    // newest first, as the backend gives them, passing over `skip`
    const newestFirst = (stored: ReturnType<typeof event>[]) =>
        vi.fn(async (skip: number, max: number) => [...stored].reverse().slice(skip, skip + max));

    test("are read newest first a page at a time, each after the ones read, and come oldest first", async () => {
        // two share a timestamp across a page break: neither is missed
        const stored = [1, 2, 3, 3, 4].map(event);
        stored[2] = { ...stored[2], amount: 7 };
        const page = newestFirst(stored);
        expect(await allChitEvents(page, 2)).toEqual(stored);
        expect(page.mock.calls.map(([skip]) => skip)).toEqual([0, 2, 4]);
    });

    test("stop after the page bound, leaving out the oldest", async () => {
        const stored = [1, 2, 3, 4, 5, 6, 7, 8].map(event);
        const page = newestFirst(stored);
        expect(await allChitEvents(page, 2, 3)).toEqual(stored.slice(2));
        expect(page).toHaveBeenCalledTimes(3);
    });

    test("are each read once though one added meanwhile moves the rest down", async () => {
        const stored = [1, 2, 3, 4].map(event);
        const page = vi.fn(async (skip: number, max: number) => {
            // a new event arrives after the first page
            if (skip > 0 && stored.length === 4) stored.push(event(5));
            return [...stored].reverse().slice(skip, skip + max);
        });
        expect((await allChitEvents(page, 2)).map((e) => Number(e.timestamp))).toEqual([
            1, 2, 3, 4,
        ]);
    });

    test("fail if a page fails", async () => {
        const page = vi.fn(async (skip: number) => {
            if (skip > 0) throw new Error("offline");
            return [event(2), event(1)];
        });
        await expect(allChitEvents(page, 2)).rejects.toThrow("offline");
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

describe("the CHIT events read newest first", () => {
    test("ask with the newest bound as `from`, as the backend reads a descending range", () => {
        expect(newestFirstChitEvents(100n, 900n, 500, 250)).toEqual({
            kind: "getChitEvents",
            from: 900n,
            to: 100n,
            max: 250,
            ascending: false,
            skip: 500,
        });
    });
});

describe("merging CHIT events", () => {
    const event = (timestamp: number, kind: "daily_claim" | "streak_insurance_claim") => ({
        amount: 1,
        timestamp: BigInt(timestamp),
        reason: { kind },
    });

    test("keeps each event once, oldest first", () => {
        const loaded = [event(1, "daily_claim"), event(3, "daily_claim")];
        // a reload from before the newest, with a marker written since at an older time
        const reloaded = [event(2, "streak_insurance_claim"), event(3, "daily_claim")];
        expect(mergeChitEvents(loaded, reloaded)).toEqual([
            event(1, "daily_claim"),
            event(2, "streak_insurance_claim"),
            event(3, "daily_claim"),
        ]);
    });

    test("keeps two events at one time when they differ", () => {
        expect(
            mergeChitEvents([event(1, "daily_claim")], [event(1, "streak_insurance_claim")]),
        ).toHaveLength(2);
    });
});

describe("what a daily claim pays", () => {
    test("follows the backend's schedule, by the streak the claim makes", () => {
        expect(
            [0, 1, 2, 3, 6, 7, 13, 14, 29, 30, 99, 100, 364, 365, 1000].map(dailyChitAmount),
        ).toEqual([0, 200, 200, 300, 300, 400, 400, 500, 500, 600, 600, 800, 800, 1000, 1000]);
    });

    test("goes up at the milestones", () => {
        expect(CHIT_STREAK_MILESTONES).toEqual([3, 7, 14, 30, 100, 365]);
        for (const m of CHIT_STREAK_MILESTONES) {
            expect(dailyChitAmount(m)).toBeGreaterThan(dailyChitAmount(m - 1));
        }
    });
});

describe("the streak ring", () => {
    test("is empty with no streak", () => {
        expect(streakRingProgress(0, false)).toBe(0);
        expect(streakRingProgress(0, true)).toBe(0);
    });

    test("fills by thirds towards the first milestone, and is full on the day it's reached", () => {
        expect(streakRingProgress(1, true)).toBeCloseTo(1 / 3);
        expect(streakRingProgress(2, false)).toBeCloseTo(2 / 3);
        expect(streakRingProgress(3, true)).toBe(1);
    });

    test("is full on each milestone the day it's claimed, then starts the next segment empty", () => {
        for (const m of CHIT_STREAK_MILESTONES.slice(0, -1)) {
            expect(streakRingProgress(m, true)).toBe(1);
            expect(streakRingProgress(m, false)).toBe(0);
        }
    });

    test("a claim never empties the ring: 3 with the claim open, then 4", () => {
        expect(streakRingProgress(3, false)).toBe(0);
        expect(streakRingProgress(4, true)).toBe(1 / 4);
    });

    test("measures from the last milestone reached to the next", () => {
        expect(streakRingProgress(4, false)).toBe(1 / 4);
        expect(streakRingProgress(6, true)).toBe(3 / 4);
        expect(streakRingProgress(8, true)).toBe(1 / 7);
        expect(streakRingProgress(65, false)).toBe(35 / 70);
    });

    test("stays full from the last milestone on", () => {
        expect(streakRingProgress(365, false)).toBe(1);
        expect(streakRingProgress(366, false)).toBe(1);
        expect(streakRingProgress(1000, true)).toBe(1);
    });

    test("follows the milestones it's given, in any order; an empty list means the default ones, as ChitDialog's does", () => {
        expect(streakRingProgress(5, true, [10, 4])).toBe(1 / 6);
        expect(streakRingProgress(4, false, [10, 4])).toBe(0);
        expect(streakRingProgress(5, true, [])).toBe(streakRingProgress(5, true));
        expect(streakRingProgress(5, true, [])).toBe(2 / 4);
    });
});
