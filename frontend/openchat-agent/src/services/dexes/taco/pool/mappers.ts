import type { ApiOptimalSwapPlan } from "./candid/idl";

// TACO returns the chosen plan with the optimizer already applied. For OC's
// quote display we only need the headline expected output.
export function optimalQuoteResponse(candid: ApiOptimalSwapPlan): bigint {
    return candid.expectedBuyAmount;
}
