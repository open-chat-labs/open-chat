import { ONE_MINUTE_MILLIS, type ChitEvent, type ChitState } from "@shared";

/** The user's streak as of `now` (ms): none once it has ended (`streakEnds`), until they claim again. */
export function currentStreak(
    state: Pick<ChitState, "streak" | "streakEnds">,
    now: number,
): number {
    return state.streakEnds < now ? 0 : state.streak;
}

/**
 * Every CHIT event `page` gives, oldest first. Read newest first a page at a time (`page` takes how
 * many to pass over and the page size), each page after the ones read so far, so events that share
 * a timestamp aren't missed. Stops at a short page, or after `maxPages` (a bound no account
 * reaches), which leaves out the oldest events, not the latest.
 */
export async function allChitEvents(
    page: (skip: number, max: number) => Promise<ChitEvent[]>,
    pageSize = 500,
    maxPages = 40,
): Promise<ChitEvent[]> {
    const events: ChitEvent[] = [];
    for (let n = 0; n < maxPages; n++) {
        const got = await page(events.length, pageSize);
        events.push(...got);
        if (got.length < pageSize) break;
    }
    return events.reverse();
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
