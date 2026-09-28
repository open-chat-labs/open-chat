import type { DexSwapResult } from "@shared";
import type { ApiOptimalSwapPlan, ApiSplitLeg, ApiSwapResult } from "./candid/idl";
import type { ExchangeError, OptimalSwapLeg } from "./candid/types";

// TACO returns the chosen plan with the optimizer already applied. For OC's
// quote display we only need the headline expected output.
export function optimalQuoteResponse(candid: ApiOptimalSwapPlan): bigint {
    return candid.expectedBuyAmount;
}

export function swapResponse(candid: ApiSwapResult): DexSwapResult {
    if ("Ok" in candid) {
        return { kind: "success", amountOut: candid.Ok.amountOut };
    }
    return { kind: "error", error: formatExchangeError(candid.Err) };
}

// Divides `grossAmountIn` between the plan's legs by their share in basis points, rounding each
// leg down and giving the remainder to the first leg, so that the legs add up to exactly
// `grossAmountIn`, which is what TACO pulls from the wallet. Slippage is checked against the swap's
// overall minimum output, so the legs have no minimum of their own.
export function splitLegs(legs: OptimalSwapLeg[], grossAmountIn: bigint): ApiSplitLeg[] {
    const amounts = legs.map((leg) => (grossAmountIn * leg.bp) / 10_000n);
    const remainder = grossAmountIn - amounts.reduce((total, amount) => total + amount, 0n);
    if (amounts.length > 0) {
        amounts[0] += remainder;
    }
    return legs.map((leg, i) => ({ amountIn: amounts[i], route: leg.route, minLegOut: 0n }));
}

function formatExchangeError(error: ExchangeError): string {
    const [kind, details] = Object.entries(error)[0];
    return details === null
        ? kind
        : `${kind}: ${JSON.stringify(details, (_, v) => (typeof v === "bigint" ? v.toString() : v))}`;
}
