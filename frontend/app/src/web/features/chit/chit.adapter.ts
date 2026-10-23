import {
    CHIT_STREAK_MILESTONES,
    currentStreak,
    dailyChitAmount,
    dailyChitClaimable,
    formatTimeRemaining,
    type ChitState,
    type StreakInsurance,
} from "@client";

// ChitDialog's and the rail's CHIT props from the user's CHIT, as the old desktop UI shows it: a
// streak that has ended is none, and today's claim is offered only while the last sync is recent
// and CHIT is on.

/** What the CHIT props are worked out from. */
export type ChitInputs = {
    chit: ChitState;
    // when the last sync finished (latestSuccessfulUpdatesLoop), ms
    lastSync: number;
    // the user has turned CHIT off (disableChit)
    disabled: boolean;
    now: number;
};

function claimable({ chit, lastSync, disabled, now }: ChitInputs): boolean {
    return !disabled && dailyChitClaimable(chit.nextDailyChitClaim, now, lastSync);
}

/** ChitDialog's props, but its puzzle, achievements and leaderboard (8d's other parts). */
export function chitDialogProps(inputs: ChitInputs, insurance: StreakInsurance) {
    const { chit, now } = inputs;
    const streak = currentStreak(chit, now);
    const open = claimable(inputs);
    return {
        streak,
        balance: chit.chitBalance,
        earned: chit.totalChitEarned,
        // what claiming pays now, or what today's claim paid
        daily: dailyChitAmount(open ? streak + 1 : Math.max(streak, 1)),
        claimable: open,
        milestones: CHIT_STREAK_MILESTONES,
        countdown: open ? "" : formatTimeRemaining(now, Number(chit.nextDailyChitClaim), true),
        insured: insurance.daysInsured,
        used: insurance.daysMissed,
    };
}

/** The rail's CHIT button: hidden while CHIT is off, and once claimed if the user hides it then. */
export function chitRailProps(inputs: ChitInputs, hideOnceClaimed: boolean) {
    const open = claimable(inputs);
    return {
        chitShown: !inputs.disabled && (open || !hideOnceClaimed),
        chitStreak: currentStreak(inputs.chit, inputs.now),
        chitClaimable: open,
    };
}
