import { mergeChitEvents, ONE_DAY, type ChitEvent, type OpenChat } from "@client";
import { calendarDay, claimDays, type ClaimDay, type OffsetMinutes } from "./claimDays";

// The CHIT claim calendar's history (ClaimHistoryDialog), and claiming from it.

/** How far back a reload starts before the newest event held. */
export const RELOAD_MARGIN_DAYS = 2;

/**
 * Where a load of the claim history starts: when the account was made (`joined`, ms) the first
 * time, as a claim's streak day follows from the ones before it, then two days before the newest
 * event held (`events`, oldest first). An insured day is marked after midnight, and a claim
 * reinstated at the end of its (past) day, so either can come in older than what's held.
 */
export function reloadFrom(events: ChitEvent[], joined: number): bigint {
    const newest = events.at(-1)?.timestamp;
    return newest === undefined ? BigInt(joined) : newest - BigInt(RELOAD_MARGIN_DAYS * ONE_DAY);
}

/**
 * The calendar's days with today's claim on them, as the claim says (its streak and the CHIT it
 * paid, made at `now`), until the history reloaded after it has it: today doesn't show as missed
 * meanwhile, nor if that reload fails.
 */
export function withTodaysClaim(
    days: ClaimDay[],
    claim: { streak: number; chitEarned: number },
    now: number,
    offsetMinutes?: OffsetMinutes,
): ClaimDay[] {
    const day = new Date(calendarDay(now, offsetMinutes)).toISOString().slice(0, 10);
    return [
        ...days.filter((d) => d.day !== day),
        {
            day,
            streakDay: claim.streak,
            amount: claim.chitEarned,
            minute: Math.floor((now % ONE_DAY) / 60_000),
            at: now,
        },
    ];
}

type Client = Pick<OpenChat, "chitHistory" | "claimDailyChit">;

/**
 * The user's claim history for the calendar, loaded from when the account was made (`joined`, ms),
 * and claiming today's CHIT from it. A load that fails leaves the days as they were; a load
 * overtaken by a later one changes nothing.
 */
export class ClaimHistory {
    days = $state<ClaimDay[]>([]);
    #events: ChitEvent[] = [];
    #run = 0;

    constructor(
        private client: Client,
        private joined: number,
    ) {}

    async load(): Promise<void> {
        const run = ++this.#run;
        try {
            const events = await this.client.chitHistory(reloadFrom(this.#events, this.joined));
            if (run !== this.#run) return;
            this.#events = mergeChitEvents(this.#events, events);
            this.days = claimDays(this.#events);
        } catch (err) {
            console.warn("Unable to load the CHIT claim history", err);
        }
    }

    /**
     * Claims today's CHIT, as the CHIT dialog does: a claim made shows on today at once, and the
     * history reloads whatever the answer (a day claimed already, elsewhere or before the client
     * knew, is on it). Rejects when the claim fails, for the dialog to say so.
     */
    async claim(now: number = Date.now()): Promise<void> {
        const resp = await this.client.claimDailyChit();
        if (resp.kind === "success") this.days = withTodaysClaim(this.days, resp, now);
        void this.load();
    }
}
