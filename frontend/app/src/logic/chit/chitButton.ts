import { currentStreak, dailyChitClaimable, type ChitState } from "@client";

// The CHIT button that opens CHIT and today's claim: the web's rail and the native Chats header.
// It offers today's claim (`claimable`, the dot) only while the last sync is recent, as stale CHIT
// could offer a claim the backend turns down. Hidden while CHIT is off, and once today's claim is
// made if the user hides it then (`hideChitIcon`).

/** What the CHIT button is worked out from. */
export type ChitButtonInputs = {
    chit: ChitState;
    /** When the last sync finished (latestSuccessfulUpdatesLoop), ms. */
    lastSync: number;
    /** The user has turned CHIT off (disableChit). */
    disabled: boolean;
    now: number;
};

export type ChitButton = {
    shown: boolean;
    streak: number;
    claimable: boolean;
};

export function chitButton(
    { chit, lastSync, disabled, now }: ChitButtonInputs,
    hideOnceClaimed: boolean,
): ChitButton {
    const claimable = !disabled && dailyChitClaimable(chit.nextDailyChitClaim, now, lastSync);
    return {
        shown: !disabled && (claimable || !hideOnceClaimed),
        streak: currentStreak(chit, now),
        claimable,
    };
}
