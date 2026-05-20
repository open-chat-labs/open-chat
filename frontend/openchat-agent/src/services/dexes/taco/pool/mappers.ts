import type { ApiQuoteResponse } from "./candid/idl";

// TACO's getExpectedReceiveAmount returns a rich quote record. OC only needs
// the headline output amount for ranking quotes.
export function quoteResponse(candid: ApiQuoteResponse): bigint {
    return candid.expectedBuyAmount;
}
