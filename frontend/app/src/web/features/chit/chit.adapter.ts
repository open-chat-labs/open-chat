import type ChitDialog from "@openchat/ui/src/features/components/ChitDialog.svelte";
import type NavRail from "@openchat/ui/src/features/components/NavRail.svelte";
import type { ComponentProps } from "svelte";
import {
    CHIT_STREAK_MILESTONES,
    currentStreak,
    dailyChitAmount,
    dailyChitClaimable,
    formatTimeRemaining,
    type ChitState,
    type StreakInsurance,
} from "@client";

// ChitDialog's and the rail's CHIT props from the user's CHIT, as the old desktop UI shows them: a
// streak that has ended is none; the rail offers today's claim only while the last sync is recent
// (stale CHIT could offer a claim the backend turns down), and the dialog, as the old CHIT modal
// does, whenever it's due (a claim already made just moves the countdown on). Neither while CHIT
// is off.

/** What the CHIT props are worked out from. */
export type ChitInputs = {
    chit: ChitState;
    // when the last sync finished (latestSuccessfulUpdatesLoop), ms
    lastSync: number;
    // the user has turned CHIT off (disableChit)
    disabled: boolean;
    now: number;
};

export type ChitDialogProps = Pick<
    ComponentProps<typeof ChitDialog>,
    | "streak"
    | "balance"
    | "earned"
    | "daily"
    | "claimable"
    | "milestones"
    | "countdown"
    | "insured"
    | "used"
>;

export type ChitRailProps = Pick<
    ComponentProps<typeof NavRail>,
    "chitShown" | "chitStreak" | "chitClaimable"
>;

/** ChitDialog's props, but its puzzle, achievements and leaderboard (8d's other parts). */
export function chitDialogProps(
    { chit, disabled, now }: ChitInputs,
    insurance: StreakInsurance,
): ChitDialogProps {
    const streak = currentStreak(chit, now);
    const claimedToday = chit.nextDailyChitClaim > now;
    return {
        streak,
        balance: chit.chitBalance,
        earned: chit.totalChitEarned,
        // what today's claim pays, or paid
        daily: dailyChitAmount(claimedToday ? Math.max(streak, 1) : streak + 1),
        claimable: !disabled && !claimedToday,
        milestones: CHIT_STREAK_MILESTONES,
        // until the next claim (none while one is due)
        countdown: claimedToday
            ? formatTimeRemaining(now, Number(chit.nextDailyChitClaim), true)
            : "",
        insured: insurance.daysInsured,
        used: insurance.daysMissed,
    };
}

/** The rail's CHIT button: hidden while CHIT is off, and once claimed if the user hides it then. */
export function chitRailProps(
    { chit, lastSync, disabled, now }: ChitInputs,
    hideOnceClaimed: boolean,
): ChitRailProps {
    const open = !disabled && dailyChitClaimable(chit.nextDailyChitClaim, now, lastSync);
    return {
        chitShown: !disabled && (open || !hideOnceClaimed),
        chitStreak: currentStreak(chit, now),
        chitClaimable: open,
    };
}
