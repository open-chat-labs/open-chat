import type { ApiQuoteResponse } from "./candid/idl";

export function quoteResponse(candid: ApiQuoteResponse): bigint {
    if ("ok" in candid) {
        return candid.ok;
    }
    throw new Error("Unable to get quote from ICPSwap: " + JSON.stringify(candid));
}
