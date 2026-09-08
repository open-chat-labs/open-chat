import type { ApiQuoteResponse } from "./candid/idl";

// A decoded `err` variant is ICPSwap declining to quote - "amount of input token is too small"
// is the usual reason - and is returned as undefined rather than thrown. Throwing here made a
// decline indistinguishable from a transport failure: executeQuery retried it seven times with
// backoff (roughly twelve seconds for a dust amount), quoteSwap could not tell "every pool
// declined" from "every pool is down", and the error tracker filled with non-events.
export function quoteResponse(candid: ApiQuoteResponse): bigint | undefined {
    if ("ok" in candid) {
        return candid.ok;
    }
    console.debug("ICPSwap declined to quote: ", candid);
    return undefined;
}
