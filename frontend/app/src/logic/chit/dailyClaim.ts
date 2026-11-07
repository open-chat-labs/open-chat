import { currentStreak, dailyChitAmount, formatTimeRemaining } from "@client";
import type { ChitButtonInputs } from "./chitButton";

// Today's CHIT claim as the web's CHIT dialog and the native You tab's CHIT card show it, as the
// old CHIT modal does: a streak that has ended is none, and the claim is offered whenever it's due
// (one already made on another device just moves the countdown on: the client does it), but not
// while CHIT is off.

export type DailyClaim = {
    streak: number;
    balance: number;
    /** All the CHIT the user has earned. */
    earned: number;
    /** What today's claim pays, or paid. */
    daily: number;
    claimable: boolean;
    /** Until the next claim, once today's is made; empty while one is due. */
    countdown: string;
};

/**
 * Unknown (undefined) until the first sync: till then the user's CHIT is a placeholder (no streak,
 * a claim due), which would offer a claim the user may have made.
 */
export function dailyClaim({
    chit,
    lastSync,
    disabled,
    now,
}: ChitButtonInputs): DailyClaim | undefined {
    if (lastSync === 0) return undefined;
    const streak = currentStreak(chit, now);
    const claimedToday = chit.nextDailyChitClaim > now;
    return {
        streak,
        balance: chit.chitBalance,
        earned: chit.totalChitEarned,
        daily: dailyChitAmount(claimedToday ? Math.max(streak, 1) : streak + 1),
        claimable: !disabled && !claimedToday,
        countdown: claimedToday
            ? formatTimeRemaining(now, Number(chit.nextDailyChitClaim), true)
            : "",
    };
}
