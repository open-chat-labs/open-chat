import { ONE_MINUTE_MILLIS, type ChitEvent, type ChitEventsRequest, type ChitState } from "@shared";

/** The user's streak as of `now` (ms): none once it has ended (`streakEnds`), until they claim again. */
export function currentStreak(
    state: Pick<ChitState, "streak" | "streakEnds">,
    now: number,
): number {
    return state.streakEnds < now ? 0 : state.streak;
}

/**
 * A page of the CHIT events between `oldest` and `newest` (ms epoch), newest first, passing over
 * `skip`. Read newest first, the backend takes `from` as the newest bound and `to` as the oldest.
 */
export function newestFirstChitEvents(
    oldest: bigint,
    newest: bigint,
    skip: number,
    max: number,
): ChitEventsRequest {
    return { kind: "getChitEvents", from: newest, to: oldest, max, ascending: false, skip };
}

// an event's identity: two events with the same are one, read twice
function chitEventKey({ timestamp, amount, reason }: ChitEvent): string {
    return `${timestamp}|${amount}|${JSON.stringify(reason)}`;
}

/** `events` then `more`, oldest first, each event once (a page or a load read it again). */
export function mergeChitEvents(events: ChitEvent[], more: ChitEvent[]): ChitEvent[] {
    const seen = new Set(events.map(chitEventKey));
    const merged = [...events];
    for (const event of more) {
        const key = chitEventKey(event);
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(event);
    }
    return merged.sort((a, b) =>
        a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0,
    );
}

/**
 * Every CHIT event `page` gives, oldest first, each once. Read newest first a page at a time
 * (`page` takes how many to pass over and the page size), each after the ones read so far, so
 * events that share a timestamp aren't missed; an event added meanwhile moves the rest down one,
 * and the one read again is dropped. Stops at a short page, or after `maxPages` (a bound no account
 * reaches), which leaves out the oldest events, not the latest.
 */
export async function allChitEvents(
    page: (skip: number, max: number) => Promise<ChitEvent[]>,
    pageSize = 500,
    maxPages = 40,
): Promise<ChitEvent[]> {
    const read: ChitEvent[] = [];
    for (let n = 0; n < maxPages; n++) {
        const got = await page(read.length, pageSize);
        read.push(...got);
        if (got.length < pageSize) break;
    }
    // oldest first, as they were made (the sort keeps events at one time in that order)
    return mergeChitEvents([], read.reverse());
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

// what a daily claim pays, by the streak it makes, from the longest: the backend's schedule
// (`chit_for_streak` in backend/libraries/user_core/src/updates/claim_daily_chit.rs)
const CLAIM_SCHEDULE: [streak: number, chit: number][] = [
    [365, 1000],
    [100, 800],
    [30, 600],
    [14, 500],
    [7, 400],
    [3, 300],
    [1, 200],
];

/** The streak lengths from which a daily claim pays more, shortest first (the backend's schedule). */
export const CHIT_STREAK_MILESTONES: number[] = CLAIM_SCHEDULE.map(([streak]) => streak)
    .filter((streak) => streak > 1)
    .reverse();

/** The CHIT a daily claim pays when it makes the streak `streak` days long, as the backend pays it. */
export function dailyChitAmount(streak: number): number {
    return CLAIM_SCHEDULE.find(([from]) => streak >= from)?.[1] ?? 0;
}
