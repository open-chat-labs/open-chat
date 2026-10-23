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
    // newest first, as the backend gives them, passing over `skip`
    const newestFirst = (stored: ReturnType<typeof event>[]) =>
        vi.fn(async (skip: number, max: number) => [...stored].reverse().slice(skip, skip + max));

    test("are read newest first a page at a time, each after the ones read, and come oldest first", async () => {
        // two share a timestamp across a page break: neither is missed
        const stored = [1, 2, 3, 3, 4].map(event);
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
