import type { DailyPuzzleResult } from "@shared";

const FIVE_MINUTES_MILLIS = 5 * 60 * 1000;

type CachedResult = {
    // undefined = the canister was asked and had no row for this user
    result: DailyPuzzleResult | undefined;
    updated: number;
};

function key(gameId: string, number: number, userId: string): string {
    return `${gameId}:${number}:${userId}`;
}

// Verified daily puzzle results keyed by game + puzzle number + user, with a TTL so a card
// that was "unverified" when first seen is re-checked on a later scroll into view.
function createDailyPuzzleResultsCache() {
    const cache = new Map<string, CachedResult>();

    function expired(entry: CachedResult, now: number): boolean {
        return now - entry.updated > FIVE_MINUTES_MILLIS;
    }

    return {
        get: (
            gameId: string,
            number: number,
            userId: string,
            now: number,
        ): CachedResult | undefined => {
            const entry = cache.get(key(gameId, number, userId));
            return entry !== undefined && !expired(entry, now) ? entry : undefined;
        },
        set: (
            gameId: string,
            number: number,
            values: Iterable<[string, DailyPuzzleResult | undefined]>,
            now: number,
        ): void => {
            for (const [k, entry] of cache) {
                if (expired(entry, now)) {
                    cache.delete(k);
                }
            }
            for (const [userId, result] of values) {
                cache.set(key(gameId, number, userId), { result, updated: now });
            }
        },
    };
}

export const dailyPuzzleResultsCache = createDailyPuzzleResultsCache();
