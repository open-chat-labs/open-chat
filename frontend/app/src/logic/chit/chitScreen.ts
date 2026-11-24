import { CHIT_STREAK_MILESTONES, dailyChitAmount, ONE_DAY, type StreakInsurance } from "@client";
import type { ClaimDay } from "./claimDays";

// The native CHIT screen's hero and its Streak milestones card (native plan 14, design notes
// §3.10): the last seven days of claims, the milestones with what each pays, and the insurance
// row, which an app store build leaves out (streak insurance is paid in CHAT).

/** One milestone of the streak: its day, the CHIT a claim pays from it on, and how far off it is. */
export type StreakMilestone = {
    days: number;
    /** What a daily claim pays from this streak day on. */
    pays: number;
    reached: boolean;
    /** Days still to go (0 once reached). */
    left: number;
    /** The next one to reach (the first not reached). */
    next: boolean;
};

/** The streak's milestones, shortest first, as the backend's claim schedule has them. */
export function streakMilestones(
    streak: number,
    milestones: readonly number[] = CHIT_STREAK_MILESTONES,
): StreakMilestone[] {
    const sorted = [...milestones].sort((a, b) => a - b);
    const next = sorted.find((days) => days > streak);
    return sorted.map((days) => ({
        days,
        pays: dailyChitAmount(days),
        reached: streak >= days,
        left: Math.max(days - streak, 0),
        next: days === next,
    }));
}

/**
 * A day of the hero's 7-day strip: claimed, covered by insurance, missed, today with its claim
 * still open, or a day before the account was made (nothing to say).
 */
export type StripDay = {
    /** The day's start, as the calendar takes it (calendarDay): a UTC date. */
    day: number;
    state: "claimed" | "insured" | "missed" | "open" | "none";
    today: boolean;
};

/**
 * The last seven days, oldest first and today last, from the claim history (`days`, as
 * ClaimHistory loads them), `today` and `joined` being calendar days (calendarDay). Today is
 * "open" until its claim is on the history.
 */
export function weekStrip(days: readonly ClaimDay[], today: number, joined: number): StripDay[] {
    const byKey = new Map(days.map((d) => [d.day, d]));
    return Array.from({ length: 7 }, (_, i) => {
        const day = today - (6 - i) * ONE_DAY;
        const held = byKey.get(new Date(day).toISOString().slice(0, 10));
        const isToday = i === 6;
        const state: StripDay["state"] =
            held?.insured === true
                ? "insured"
                : held !== undefined
                  ? "claimed"
                  : isToday
                    ? "open"
                    : day < joined
                      ? "none"
                      : "missed";
        return { day, state, today: isToday };
    });
}

/**
 * The hero's streak insurance row: the days of cover held (bought less used) and those used; none
 * in an app store build (`off`: no purchase paid in tokens, and insurance is paid in CHAT).
 */
export function insuranceRow(
    { daysInsured, daysMissed }: StreakInsurance,
    off: boolean,
): { held: number; used: number } | undefined {
    if (off) return undefined;
    return { held: Math.max(daysInsured - daysMissed, 0), used: daysMissed };
}
