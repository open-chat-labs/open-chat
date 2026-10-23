import { ONE_MINUTE_MILLIS, type ChitEvent, type ChitState } from "@shared";

/** The user's streak as of `now` (ms): none once it has ended (`streakEnds`), until they claim again. */
export function currentStreak(
    state: Pick<ChitState, "streak" | "streakEnds">,
    now: number,
): number {
    return state.streakEnds < now ? 0 : state.streak;
}

/**
 * Every CHIT event from `from` (ms epoch) on, oldest first, read a page at a time with `page`
 * (`from`, the page size: up to that many events from `from`, oldest first). Stops at a short
 * page, or after `maxPages` (a bound, not a limit any account reaches).
 */
export async function allChitEvents(
    page: (from: bigint, max: number) => Promise<ChitEvent[]>,
    from: bigint,
    pageSize = 500,
    maxPages = 40,
): Promise<ChitEvent[]> {
    const events: ChitEvent[] = [];
    let next = from;
    for (let n = 0; n < maxPages; n++) {
        const got = await page(next, pageSize);
        events.push(...got);
        if (got.length < pageSize) break;
        next = got[got.length - 1].timestamp + 1n;
    }
    return events;
}

// how recent the last sync must be for the claim to be offered where that's checked: older, and
// the CHIT state may be out of date
const CLAIM_SYNC_MAX_AGE_MS = 10 * ONE_MINUTE_MILLIS;

/**
 * Whether today's CHIT can be claimed as of `now` (ms): the next claim's time has come. With
 * `lastSync` (ms), only while that's recent too, as the old desktop rail offers it.
 */
export function dailyChitClaimable(
    nextDailyChitClaim: bigint,
    now: number,
    lastSync?: number,
): boolean {
    return (
        nextDailyChitClaim < now &&
        (lastSync === undefined || lastSync > now - CLAIM_SYNC_MAX_AGE_MS)
    );
}
