import { describe, expect, test } from "vitest";
import { optimalQuoteResponse, splitLegs, swapResponse } from "./mappers";
import type { OptimalSwapLeg, OptimalSwapPlan } from "./candid/types";

function leg(bp: bigint, tokenOut: string): OptimalSwapLeg {
    return {
        bp,
        expectedBuyAmount: 0n,
        route: [{ tokenIn: "in", tokenOut }],
        routeDescription: "",
    };
}

describe("TACO splitLegs", () => {
    test("legs are the plan's shares of the gross amount, keeping each leg's route", () => {
        const legs = [leg(6_000n, "a"), leg(4_000n, "b")];
        expect(splitLegs(legs, 1_000n)).toEqual([
            { amountIn: 600n, route: legs[0].route, minLegOut: 0n },
            { amountIn: 400n, route: legs[1].route, minLegOut: 0n },
        ]);
    });

    // TACO pulls exactly the sum of the legs, so it must equal the gross amount that was approved
    test("the rounding remainder goes to the first leg so the legs add up to the gross amount", () => {
        const split = splitLegs([leg(3_333n, "a"), leg(3_333n, "b"), leg(3_334n, "c")], 1_001n);
        expect(split.map((l) => l.amountIn)).toEqual([335n, 333n, 333n]);
        expect(split.reduce((total, l) => total + l.amountIn, 0n)).toBe(1_001n);
    });
});

describe("TACO swapResponse", () => {
    test("Ok is a success with the amount out", () => {
        expect(
            swapResponse({
                Ok: {
                    amountIn: 1_005n,
                    amountOut: 2_000n,
                    fee: 5n,
                    firstHopOrderbookMatch: false,
                    hops: 1n,
                    lastHopAMMOnly: true,
                    route: [],
                    swapId: 1n,
                    tokenIn: "in",
                    tokenOut: "out",
                },
            }),
        ).toEqual({ kind: "success", amountOut: 2_000n });
    });

    test("Err is an error naming the variant and its details", () => {
        expect(swapResponse({ Err: { ExchangeFrozen: null } })).toEqual({
            kind: "error",
            error: "ExchangeFrozen",
            rateChanged: false,
        });
        expect(swapResponse({ Err: { InsufficientFunds: "V2 pull declined" } })).toEqual({
            kind: "error",
            error: 'InsufficientFunds: "V2 pull declined"',
            rateChanged: false,
        });
    });

    // TACO delivers the output of a swap which fell short of the minimum once made, and a route
    // failing part way along leaves the user with the token it got to
    test("an Err after which the swap may have gone ahead is unconfirmed", () => {
        expect(swapResponse({ Err: { SlippageExceeded: { expected: 10n, got: 9n } } })).toEqual({
            kind: "unconfirmed",
            error: 'SlippageExceeded: {"expected":"10","got":"9"}',
        });
        expect(swapResponse({ Err: { RouteFailed: { hop: 1n, reason: "No output" } } })).toEqual({
            kind: "unconfirmed",
            error: 'RouteFailed: {"hop":"1","reason":"No output"}',
        });
        expect(swapResponse({ Err: { SystemError: "outcome UNKNOWN" } }).kind).toBe("unconfirmed");
    });
});

describe("TACO optimalQuoteResponse", () => {
    function plan(canFulfillFully: boolean, legs: OptimalSwapLeg[]): OptimalSwapPlan {
        return {
            fee: 0n,
            tradingFeeBps: 5n,
            routeDescription: "",
            canFulfillFully,
            legs,
            priceImpact: 0,
            expectedBuyAmount: 2_000n,
        };
    }

    test("the quote is the plan's expected output", () => {
        expect(optimalQuoteResponse(plan(true, [leg(10_000n, "a")]))).toBe(2_000n);
    });

    // eg. an amount too small to cover TACO's fees, which it plans as no legs, or one too large for
    // its liquidity
    test("a plan which can't fill the swap is a decline", () => {
        expect(optimalQuoteResponse(plan(false, []))).toBeUndefined();
        expect(optimalQuoteResponse(plan(false, [leg(10_000n, "a")]))).toBeUndefined();
        expect(optimalQuoteResponse(plan(true, []))).toBeUndefined();
    });
});
