import { describe, expect, test } from "vitest";
import { splitLegs, swapResponse } from "./mappers";
import type { OptimalSwapLeg } from "./candid/types";

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
        });
        expect(swapResponse({ Err: { SlippageExceeded: { expected: 10n, got: 9n } } })).toEqual({
            kind: "error",
            error: 'SlippageExceeded: {"expected":"10","got":"9"}',
        });
    });
});
