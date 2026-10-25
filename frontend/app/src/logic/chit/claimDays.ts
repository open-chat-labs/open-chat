import { ONE_DAY, type ChitEvent } from "@client";

// The CHIT claim calendar's days (ClaimCalendar) from the user's CHIT events.

/**
 * One day of the claim calendar, as ClaimCalendar draws it: the user's own date (`day`,
 * YYYY-MM-DD), its streak day, and either the CHIT claimed (with the minute of the UTC day it was
 * claimed, and when, in ms: `at`) or that streak insurance covered it.
 */
export type ClaimDay = {
    day: string;
    streakDay: number;
    amount?: number;
    minute?: number;
    at?: number;
    insured?: boolean;
};

// the user's time zone at a moment, in minutes east of UTC
export type OffsetMinutes = (ms: number) => number;
const browserOffset: OffsetMinutes = (ms) => -new Date(ms).getTimezoneOffset();

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

// a calendar day's key, from its start (calendarDay)
function dayKey(day: number): string {
    return new Date(day).toISOString().slice(0, 10);
}

/**
 * The user's own day `ms` falls on, as the CHIT calendar takes its days: that date's midnight in
 * UTC (the calendar lays out UTC dates, and the backend counts a streak in the user's time zone,
 * so its `today`, `joined` and claims all go by the user's date).
 */
export function calendarDay(ms: number, offsetMinutes: OffsetMinutes = browserOffset): number {
    return Math.floor((ms + offsetMinutes(ms) * MINUTE) / ONE_DAY) * ONE_DAY;
}

// An insured or reinstated day is marked at the last ms of that day in the zone the user claimed
// from (the backend's), which needn't be this browser's: the zone (whole minutes, UTC-12 to
// UTC+14) that makes the next ms a day's start, the one closest to `here` when two do. Undefined
// for a timestamp that isn't a day's last ms in any zone.
function markerOffset(ms: number, here: number): number | undefined {
    const end = ms + 1;
    const rest = ((-end % ONE_DAY) + ONE_DAY) % ONE_DAY;
    if (rest % MINUTE !== 0) return undefined;
    return [rest - ONE_DAY, rest]
        .filter((o) => o >= -12 * HOUR && o <= 14 * HOUR)
        .reduce((best, o) => (Math.abs(o - here) < Math.abs(best - here) ? o : best));
}

type DayEvent = { kind: ChitEvent["reason"]["kind"]; ms: number; amount: number };

/**
 * The CHIT calendar's days from the user's CHIT events (any order): a daily claim, a claim
 * reinstated, or a day covered by streak insurance, each on the user's own day, as the backend
 * counts it. The backend doesn't say which zone each claim was made in, but it does guarantee:
 * - a marker (an insured or reinstated day) is that day's last ms in the zone it was made in, so
 *   its day is known;
 * - insurance covers the day after the last one claimed, so the claim before a run of insured
 *   days is on the day before the first of them;
 * - each claim or marker, in time order, is on a later day than the one before.
 * So those days are fixed, any other claim is placed in this browser's zone, and then moved, if
 * it must be, to come before the one after it and after the one before it, in that order: the
 * newest claims are the likeliest to have been made in this browser's zone, so where two collide
 * the older one moves back. One a day: the first
 * claim, or else the day's marker. Each one's streak day follows from the days before it: one
 * more than the day before, or 1 after a gap. A reinstated claim is a kept day with nothing
 * earned.
 */
export function claimDays(
    events: ChitEvent[],
    offsetMinutes: OffsetMinutes = browserOffset,
): ClaimDay[] {
    const isMarker = (kind: ChitEvent["reason"]["kind"]) =>
        kind === "daily_claim_reinstated" || kind === "streak_insurance_claim";
    const items = [...events]
        .sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1))
        .filter(({ reason }) => reason.kind === "daily_claim" || isMarker(reason.kind))
        .map(({ reason, timestamp, amount }) => {
            const kind = reason.kind;
            const ms = Number(timestamp);
            let fixed: number | undefined;
            if (isMarker(kind)) {
                const offset = markerOffset(ms, offsetMinutes(ms) * MINUTE);
                fixed =
                    offset === undefined
                        ? calendarDay(ms, offsetMinutes)
                        : ms + 1 + offset - ONE_DAY;
            }
            return { kind, ms, amount, fixed, day: fixed ?? calendarDay(ms, offsetMinutes) };
        });
    // the claim before a run of insured days
    items.forEach((item, i) => {
        const next = items[i + 1];
        if (
            item.kind === "daily_claim" &&
            next?.kind === "streak_insurance_claim" &&
            next.fixed !== undefined
        ) {
            item.fixed = item.day = next.fixed - ONE_DAY;
        }
    });
    // before the one after, then after the one before
    for (let i = items.length - 2; i >= 0; i--) {
        const item = items[i];
        if (item.fixed === undefined) item.day = Math.min(item.day, items[i + 1].day - ONE_DAY);
    }
    for (let i = 1; i < items.length; i++) {
        const item = items[i];
        if (item.fixed === undefined) item.day = Math.max(item.day, items[i - 1].day + ONE_DAY);
    }

    const byDay = new Map<number, DayEvent>();
    for (const { kind, ms, amount, day } of items) {
        const had = byDay.get(day);
        if (had === undefined || (had.kind !== "daily_claim" && kind === "daily_claim")) {
            byDay.set(day, { kind, ms, amount });
        }
    }
    const days: ClaimDay[] = [];
    let last: { day: number; streakDay: number } | undefined;
    for (const [day, { kind, ms, amount }] of [...byDay].sort(([a], [b]) => a - b)) {
        const streakDay = last?.day === day - ONE_DAY ? last.streakDay + 1 : 1;
        last = { day, streakDay };
        const key = dayKey(day);
        if (kind === "streak_insurance_claim") {
            days.push({ day: key, streakDay, insured: true });
        } else if (kind === "daily_claim_reinstated") {
            days.push({ day: key, streakDay, amount: 0 });
        } else {
            days.push({
                day: key,
                streakDay,
                amount,
                minute: Math.floor((ms % ONE_DAY) / MINUTE),
                at: ms,
            });
        }
    }
    return days;
}
