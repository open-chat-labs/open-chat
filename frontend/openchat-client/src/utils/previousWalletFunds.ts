import { ONE_DAY, ONE_HOUR, type FundsInPreviousWallet, type MoveFundsOutcome } from "@shared";

// How long after the wallets of the canisters a user had before being migrated to a MultiUser
// canister have been checked for funds to check them again. Each check queries each wallet's
// balance on every token, and funds only reach those wallets now if sent from outside OpenChat, so
// once a day is plenty. A move which failed is tried again sooner, since that's usually because the
// old canister was still being closed out or its cycles refunded. It isn't tried on every load
// though, since each attempt which gets as far as a transfer costs the LocalUserIndex cycles.
export const PREVIOUS_WALLETS_CHECK_INTERVAL = ONE_DAY;
export const PREVIOUS_WALLETS_RETRY_INTERVAL = ONE_HOUR;

// Moves anything left in the user's previous wallets to their wallet, if they have any and a check
// is due, returning the outcome on each ledger moved from, or undefined if no check was made. The
// next check is put off before this one starts, so that tabs loading at the same time don't each
// make it, and one which is cut short is tried again later.
export async function movePreviousWalletFunds(
    user: { userId: string; previousUserIds?: string[] },
    find: () => Promise<FundsInPreviousWallet[]>,
    move: (funds: FundsInPreviousWallet[]) => Promise<MoveFundsOutcome[]>,
    now: number = Date.now(),
): Promise<MoveFundsOutcome[] | undefined> {
    if ((user.previousUserIds ?? []).length === 0) return undefined;

    const key = `openchat_previous_wallets_next_check_${user.userId}`;
    if (now < nextCheck(key)) return undefined;
    setNextCheck(key, now + PREVIOUS_WALLETS_RETRY_INTERVAL);

    const outcomes = await move(await find());
    const failed = outcomes.some((o) => o.result.kind === "failed");
    setNextCheck(
        key,
        now + (failed ? PREVIOUS_WALLETS_RETRY_INTERVAL : PREVIOUS_WALLETS_CHECK_INTERVAL),
    );
    return outcomes;
}

// Without storage, the wallets are checked on every load
function nextCheck(key: string): number {
    try {
        return Number(localStorage.getItem(key) ?? 0) || 0;
    } catch {
        return 0;
    }
}

function setNextCheck(key: string, at: number) {
    try {
        localStorage.setItem(key, at.toString());
    } catch {
        // Checked again on the next load
    }
}
