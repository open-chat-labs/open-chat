import type { ApiQuoteResponse } from "./candid/idl";
import type { Error as ApiQuoteError } from "./candid/types";

// A decoded `err` variant is ICPSwap declining to quote - "amount of input token is too small"
// is the usual reason - and is returned as undefined rather than thrown. Throwing here made a
// decline indistinguishable from a transport failure: executeQuery retried it seven times with
// backoff (roughly twelve seconds for a dust amount), quoteSwap could not tell "every pool
// declined" from "every pool is down", and the error tracker filled with non-events.
export function quoteResponse(candid: ApiQuoteResponse): bigint | undefined {
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
// Rollbar #31881 - so that one message is a decline too. Anything else keeps throwing, which
// keeps executeQuery's retries for a pool that is genuinely struggling.
function isDecline(err: ApiQuoteError): boolean {
    if ("InsufficientFunds" in err || "UnsupportedToken" in err) return true;
    return "InternalError" in err && /too small/i.test(err.InternalError);
}
