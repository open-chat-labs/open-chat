import {
    ErrorCode,
    ONE_DAY,
    ONE_HOUR,
    ONE_WEEK,
    type FundsInPreviousWallet,
    type MoveFundsOutcome,
    type OCError,
} from "@shared";

// How long after the wallets of the canisters a user had before being migrated to a MultiUser
// canister have been checked for funds to check them again. Each check queries each wallet's
// balance on every token, and funds only reach those wallets now if sent from outside OpenChat, so
// once a day is plenty. A move which failed for a passing reason (see `retryFor`) is tried again
// sooner, since that's usually because the old canister was still being closed out or its cycles
// refunded. It isn't tried on every load though, since each attempt which gets as far as a
// transfer costs the LocalUserIndex cycles.
export const PREVIOUS_WALLETS_CHECK_INTERVAL = ONE_DAY;
export const PREVIOUS_WALLETS_RETRY_INTERVAL = ONE_HOUR;
// A balance whose move failed with an error from the LocalUserIndex, eg. because the ledger refuses
// every transfer, fails the same way each time it's tried while it stays the same, so it isn't
// tried again until it changes, or until this long has passed, in case the ledger has recovered
export const PREVIOUS_WALLETS_STUCK_RETRY_INTERVAL = ONE_WEEK;

// When a move which failed is tried again
type Retry =
    // An hour later: the old canister was busy, the LocalUserIndex was short of cycles or hadn't
    // yet loaded the tokens from the Registry, or, with `Unknown` or a negative code, the call
    // failed on the client before an answer came back
    | "soon"
    // At the next daily check: a call failed, eg. because a subnet was busy or a ledger was being
    // upgraded, or the LocalUserIndex, which reloads the Registry's tokens daily, didn't yet know
    // the ledger. Either may last, so isn't worth trying hourly, but nor is it reason enough to
    // hold the balance back for a week.
    | "next_check"
    // Once the balance changes, or after `PREVIOUS_WALLETS_STUCK_RETRY_INTERVAL`
    | "stuck";

// A balance whose move failed and was then stuck, and when it failed
type StuckBalance = {
    previousUserId: string;
    ledger: string;
    balance: string;
    failedAt: number;
};

// Moves anything left in the user's previous wallets to their wallet, if they have any and a check
// is due, returning the outcome on each ledger moved from, or undefined if no check was made. The
// next check is put off before this one starts, so that tabs loading at the same time don't each
// make it, and one which is cut short, or in which the wallets couldn't be checked, is tried again
// later. A stuck balance (see `PREVIOUS_WALLETS_STUCK_RETRY_INTERVAL`) is passed over, and gets no
// outcome.
export async function movePreviousWalletFunds(
    user: { userId: string; previousUserIds?: string[] },
    find: () => Promise<FundsInPreviousWallet[]>,
    move: (funds: FundsInPreviousWallet[]) => Promise<MoveFundsOutcome[]>,
    now: number = Date.now(),
): Promise<MoveFundsOutcome[] | undefined> {
    if ((user.previousUserIds ?? []).length === 0) return undefined;

    const key = `openchat_previous_wallets_next_check_${user.userId}`;
    const next = nextCheck(key);
    // A check further off than any is put off for was put off by a clock which was ahead
    if (now < next && next <= now + PREVIOUS_WALLETS_CHECK_INTERVAL) return undefined;
    setNextCheck(key, now + PREVIOUS_WALLETS_RETRY_INTERVAL);

    let funds: FundsInPreviousWallet[];
    try {
        funds = await find();
    } catch {
        return undefined;
    }

    // A stuck balance which has since changed, or gone, is forgotten here. So is one whose balance
    // couldn't be read this time, since `find` leaves it out, which costs one more failed move.
    const stuckKey = `openchat_previous_wallets_stuck_${user.userId}`;
    const stillStuck = stuckBalances(stuckKey).filter(
        (s) =>
            s.failedAt <= now &&
            now < s.failedAt + PREVIOUS_WALLETS_STUCK_RETRY_INTERVAL &&
            funds.some((f) => isSameBalance(s, f)),
    );
    const outcomes = await move(funds.filter((f) => !stillStuck.some((s) => isSameBalance(s, f))));

    const newlyStuck = outcomes.flatMap(({ previousUserId, ledger, result }): StuckBalance[] => {
        if (result.kind !== "failed" || retryFor(result.error) !== "stuck") return [];
        const funded = funds.find(
            (f) => f.previousUserId === previousUserId && f.ledger === ledger,
        );
        return funded === undefined
            ? []
            : [{ previousUserId, ledger, balance: funded.balance.toString(), failedAt: now }];
    });
    setStuckBalances(stuckKey, [...stillStuck, ...newlyStuck]);

    const retrySoon = outcomes.some(
        (o) => o.result.kind === "failed" && retryFor(o.result.error) === "soon",
    );
    setNextCheck(
        key,
        now + (retrySoon ? PREVIOUS_WALLETS_RETRY_INTERVAL : PREVIOUS_WALLETS_CHECK_INTERVAL),
    );
    return outcomes;
}

function retryFor(error: OCError): Retry {
    if (error.code <= ErrorCode.Unknown) return "soon";
    switch (error.code) {
        case ErrorCode.AlreadyInProgress:
        case ErrorCode.CyclesBalanceTooLow:
        case ErrorCode.NotInitialized:
            return "soon";
        case ErrorCode.C2CError:
        case ErrorCode.LedgerNotFound:
            return "next_check";
        default:
            return "stuck";
    }
}

function isSameBalance(stuck: StuckBalance, funds: FundsInPreviousWallet): boolean {
    return (
        stuck.previousUserId === funds.previousUserId &&
        stuck.ledger === funds.ledger &&
        stuck.balance === funds.balance.toString()
    );
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

// Without storage, or if what's stored can't be read, nothing is stuck
function stuckBalances(key: string): StuckBalance[] {
    try {
        const stored: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
        return Array.isArray(stored) ? stored.filter(isStuckBalance) : [];
    } catch {
        return [];
    }
}

function isStuckBalance(value: unknown): value is StuckBalance {
    return (
        typeof value === "object" &&
        value !== null &&
        "previousUserId" in value &&
        typeof value.previousUserId === "string" &&
        "ledger" in value &&
        typeof value.ledger === "string" &&
        "balance" in value &&
        typeof value.balance === "string" &&
        "failedAt" in value &&
        typeof value.failedAt === "number"
    );
}

function setStuckBalances(key: string, stuck: StuckBalance[]) {
    try {
        if (stuck.length === 0) {
            localStorage.removeItem(key);
        } else {
            localStorage.setItem(key, JSON.stringify(stuck));
        }
    } catch {
        // Tried again on the next check
    }
}
