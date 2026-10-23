import type { ChitEvent, ChitState } from "@shared";

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
