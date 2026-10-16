import { beforeEach, describe, expect, test } from "vitest";
import type { OptimalSwapLeg, OptimalSwapPlan, SwapResult } from "./candid/types";
import { TacoPoolClient } from "./taco.pool.client";

const ICP = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const CHAT = "2ouva-viaaa-aaaaq-aaamq-cai";

function leg(bp: bigint, tokenOut: string): OptimalSwapLeg {
    return {
        bp,
        expectedBuyAmount: 0n,
        route: [{ tokenIn: ICP, tokenOut }],
        routeDescription: "",
    };
}

function plan(legs: OptimalSwapLeg[], expectedBuyAmount = 2_000n): OptimalSwapPlan {
    return {
        fee: 0n,
        tradingFeeBps: 5n,
        routeDescription: "",
        canFulfillFully: legs.length > 0,
        legs,
        priceImpact: 0,
        expectedBuyAmount,
    };
}

const SWAPPED: SwapResult = {
    Ok: {
        amountIn: 1_001n,
        amountOut: 1_990n,
        fee: 0n,
        firstHopOrderbookMatch: false,
        hops: 1n,
        lastHopAMMOnly: true,
        route: [],
        swapId: 1n,
        tokenIn: ICP,
        tokenOut: CHAT,
    },
};

// TACO is quoted, plans and swaps on the gross amount it pulls from the wallet, out of which it takes
// its own fees
describe("TacoPoolClient", () => {
    let calls: unknown[][];
    let nextPlan: OptimalSwapPlan;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let client: any;

    beforeEach(() => {
        calls = [];
        nextPlan = plan([leg(10_000n, CHAT)]);
        client = Object.create(TacoPoolClient.prototype);
        const called =
            (name: string, response: () => unknown) =>
            (...args: unknown[]) => {
                calls.push([name, ...args]);
                return Promise.resolve(response());
            };
        client.service = {
            getExpectedReceiveAmountBatchMultiOptimalV2: called("plan", () => nextPlan),
            swapMultiHopV2: called("swapMultiHop", () => SWAPPED),
            swapSplitRoutesV2: called("swapSplitRoutes", () => SWAPPED),
        };
    });

    // TACO pays the output token's fee for sending the output to the wallet
    test("quotes the plan's expected output for the gross amount, as it reaches the wallet", async () => {
        expect(await client.quote(ICP, CHAT, 1_001n, 10n)).toBe(2_000n);
        expect(calls).toEqual([["plan", ICP, CHAT, 1_001n]]);
    });

    test("declines to quote a plan which can't fill the swap, or nothing at all", async () => {
        nextPlan = plan([]);
        expect(await client.quote(ICP, CHAT, 1_001n, 10n)).toBeUndefined();
        expect(await client.quote(ICP, CHAT, 0n, 10n)).toBeUndefined();
        expect(calls).toHaveLength(1);
    });

    test("swaps a single leg plan for the gross amount it was planned on", async () => {
        expect(await client.swapFromWallet(ICP, CHAT, 1_001n, 1_900n)).toEqual({
            kind: "success",
            amountOut: 1_990n,
        });
        expect(calls).toEqual([
            ["plan", ICP, CHAT, 1_001n],
            ["swapMultiHop", ICP, CHAT, 1_001n, nextPlan.legs[0].route, 1_900n],
        ]);
    });

    test("splits the gross amount between the legs of a split plan", async () => {
        nextPlan = plan([leg(6_000n, CHAT), leg(4_000n, CHAT)]);

        await client.swapFromWallet(ICP, CHAT, 1_001n, 1_900n);

        expect(calls[0]).toEqual(["plan", ICP, CHAT, 1_001n]);
        const [name, , , legs, minAmountOut] = calls[1];
        expect(name).toBe("swapSplitRoutes");
        expect((legs as { amountIn: bigint }[]).map((l) => l.amountIn)).toEqual([601n, 400n]);
        expect(minAmountOut).toBe(1_900n);
    });

    // TACO would refuse these too, but keep its fees
    test("refuses a swap TACO no longer expects to fill for the minimum, without swapping", async () => {
        for (const p of [plan([]), plan([leg(10_000n, CHAT)], 1_899n)]) {
            nextPlan = p;
            calls = [];

            const result = await client.swapFromWallet(ICP, CHAT, 1_001n, 1_900n);

            expect(result).toMatchObject({ kind: "error", rateChanged: true });
            expect(calls.map((c) => c[0])).toEqual(["plan"]);
        }
    });
});
