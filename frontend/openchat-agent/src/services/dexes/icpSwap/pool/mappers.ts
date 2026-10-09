import type { DexSwapResult } from "@shared";
import type { ApiNatResult, ApiUnusedBalanceResult } from "./candid/idl";
import type { Error as ApiQuoteError } from "./candid/types";

// A decoded `err` variant is ICPSwap declining to quote - "amount of input token is too small"
// is the usual reason - and is returned as undefined rather than thrown. Throwing here made a
// decline indistinguishable from a transport failure: executeQuery retried it seven times with
// backoff (roughly twelve seconds for a dust amount), quoteSwap could not tell "every pool
// declined" from "every pool is down", and the error tracker filled with non-events.
export function quoteResponse(candid: ApiNatResult): bigint | undefined {
    if ("ok" in candid) {
        return candid.ok;
    }
    if (isDecline(candid.err)) {
        console.debug("ICPSwap declined to quote: ", candid.err);
        return undefined;
    }
    throw new Error("Unable to get quote from ICPSwap: " + JSON.stringify(candid));
}

// Which `err` variants mean "this pool will not quote this request" as opposed to "this pool
// failed to answer". InsufficientFunds and UnsupportedToken are declines by definition.
// InternalError is nominally a failure, but ICPSwap reports the commonest decline of all through
// it - `{"InternalError":"The amount of input token is too small."}` is the exact payload behind
// Rollbar #31881 - so that one message is a decline too. So are the pool refusing a swap of this
// size or direction: `preswap "price limit out of bound"` (its price is at the edge of its range,
// with no liquidity that way) or "The maximum amount of input tokens is N" (Rollbar #31905).
// Neither clears on a retry seconds later. Anything else keeps throwing, which keeps
// executeQuery's retries for a pool that is genuinely struggling.
function isDecline(err: ApiQuoteError): boolean {
    if ("InsufficientFunds" in err || "UnsupportedToken" in err) return true;
    return (
        "InternalError" in err &&
        /too small|price limit out of bound|maximum amount of input tokens/i.test(err.InternalError)
    );
}

// The pool reports the output before taking the output token's fee to send it to the wallet, so the
// fee is deducted here to give what reaches the wallet, as the backend's swaps do
export function swapResponse(candid: ApiNatResult, outputTokenFee: bigint): DexSwapResult {
    if ("ok" in candid) {
        return {
            kind: "success",
            amountOut: candid.ok > outputTokenFee ? candid.ok - outputTokenFee : 0n,
        };
    }
    return { kind: "error", error: JSON.stringify(candid.err) };
}

export function unusedBalancesResponse(
    candid: ApiUnusedBalanceResult,
    token0: string,
    token1: string,
): { ledger: string; balance: bigint }[] {
    if ("ok" in candid) {
        return [
            { ledger: token0, balance: candid.ok.balance0 },
            { ledger: token1, balance: candid.ok.balance1 },
        ];
    }
    throw new Error("Unable to get unused balances from ICPSwap: " + JSON.stringify(candid.err));
}

export function withdrawResponse(candid: ApiNatResult): boolean {
    if ("ok" in candid) {
        return true;
    }
    console.warn("Failed to withdraw from ICPSwap", candid.err);
    return false;
}
