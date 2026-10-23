import {
    allChitEvents,
    currentStreak,
    dailyChitClaimable,
    mergeChitEvents,
    newestFirstChitEvents,
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
