import type { DexSwapResult } from "@shared";
import type { ApiOptimalSwapPlan, ApiSplitLeg, ApiSwapResult } from "./candid/idl";
import type { OptimalSwapLeg } from "./candid/types";

// The errors after which a swap may have gone ahead, at least in part. TACO refuses a swap whose
// estimated output falls short of the minimum, but one whose actual output falls short has been made
// already, so is delivered anyway, with the same error. A route failing part way along leaves the
// user with the token it had got to. A transfer TACO couldn't confirm is tracked by TACO, for an
// admin to resolve. So is a pull which reached the exchange but another of TACO's processes claimed
// first, which TACO reports as invalid input (see `CLAIMED_ALREADY`). Every other error is TACO
// refusing the swap before pulling anything.
const CLAIMED_ALREADY = "already claimed by a concurrent";
const UNCONFIRMED_ERRORS = new Set([
    "RouteFailed",
    "SlippageExceeded",
    "SystemError",
    "TransferFailed",
]);

// TACO returns the chosen plan with the optimizer already applied. For OC's
// quote display we only need the headline expected output, which is what reaches the wallet, since
// TACO pays the fee for sending it. A plan which can't fill the swap is a decline.
export function optimalQuoteResponse(candid: ApiOptimalSwapPlan): bigint | undefined {
    return fillsSwap(candid) ? candid.expectedBuyAmount : undefined;
}

// Whether TACO's plan swaps all of the amount it was asked to. An amount too small to cover TACO's
// fees is planned as no legs.
export function fillsSwap(plan: ApiOptimalSwapPlan): boolean {
    return plan.canFulfillFully && plan.legs.length > 0;
}

// `amountOut` is what reaches the wallet, as for the quote
export function swapResponse(candid: ApiSwapResult): DexSwapResult {
    if ("Ok" in candid) {
        return { kind: "success", amountOut: candid.Ok.amountOut };
    }
    const [kind, details] = Object.entries(candid.Err)[0];
    const error =
        details === null
            ? kind
            : `${kind}: ${JSON.stringify(details, (_, v) => (typeof v === "bigint" ? v.toString() : v))}`;
    const claimedAlready =
        "InvalidInput" in candid.Err && candid.Err.InvalidInput.includes(CLAIMED_ALREADY);
    // TACO's refusal to swap at the rate it estimates can't be told apart from a swap it made at a
    // worse one, so neither is taken to be down to the rate having changed
    return UNCONFIRMED_ERRORS.has(kind) || claimedAlready
        ? { kind: "unconfirmed", error }
        : { kind: "error", error, rateChanged: false };
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
