import type { ApiBatchMultiResponse } from "./candid/idl";
import { buildSwapPlan } from "./optimizer";

// Run the same split-route optimizer the user_canister backend uses at
// execution time, so the displayed quote matches the actual deliverable.
export function batchMultiQuoteResponse(
    candid: ApiBatchMultiResponse,
    bps: bigint[],
): bigint {
    return buildSwapPlan(candid, bps).expectedOut;
}
