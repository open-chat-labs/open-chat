import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import type { DexSwapResult } from "@shared";
import { idlFactory, type TacoExchangePoolService } from "./candid/idl";
import { CandidCanisterAgent } from "../../../canisterAgent/candid";
import { fillsSwap, optimalQuoteResponse, splitLegs, swapResponse } from "./mappers";
import type { SwapPoolClient } from "../../index";
import { TACO_EXCHANGE_CANISTER_ID } from "../index/mappers";
import { identity } from "../../../../utils/mapping";

export class TacoPoolClient
    extends CandidCanisterAgent<TacoExchangePoolService>
    implements SwapPoolClient
{
    constructor(identity: Identity, agent: HttpAgent, _token0: string, _token1: string) {
        // TACO routes internally; the pool client doesn't need the token
        // ordering. Constructor signature stays symmetric with ICPSwap's so
        // SwapIndexClient.getPoolClient remains polymorphic.
        super(identity, agent, TACO_EXCHANGE_CANISTER_ID, idlFactory, "TacoExchangePool");
    }

    // Quotes swapping `grossAmountIn`, ie. all that TACO pulls from the wallet, of which what is
    // swapped is what is left once TACO's trading fee and the input token's transfer fee are taken
    quote(
        inputToken: string,
        outputToken: string,
        grossAmountIn: bigint,
    ): Promise<bigint | undefined> {
        // Single canister call: TACO runs the BatchMulti probe grid AND the
        // split-route optimizer internally and returns just the optimal output.
        // No local optimizer needed — the canister is the source of truth.
        if (grossAmountIn <= 0n) return Promise.resolve(undefined);
        const args: [string, string, bigint] = [inputToken, outputToken, grossAmountIn];
        return this.handleQueryResponse(
            () => this.service.getExpectedReceiveAmountBatchMultiOptimalV2(...args),
            optimalQuoteResponse,
            args,
        );
    }

    // Swaps straight from the caller's wallet, following the plan TACO picks, which may split the
    // swap across several routes. TACO pulls `grossAmountIn` from the wallet via ICRC2, as quoted, so
    // the caller must first approve the exchange canister for `grossAmountIn` plus the input token's
    // fee, for the pull. TACO queues the output's transfer back to the wallet, so it can land a few
    // seconds after this returns. A failed swap can still have moved funds (see `swapResponse`).
    async swapFromWallet(
        inputToken: string,
        outputToken: string,
        grossAmountIn: bigint,
        minAmountOut: bigint,
    ): Promise<DexSwapResult> {
        const planArgs: [string, string, bigint] = [inputToken, outputToken, grossAmountIn];
        const plan = await this.handleQueryResponse(
            () => this.service.getExpectedReceiveAmountBatchMultiOptimalV2(...planArgs),
            identity,
            planArgs,
        );

        // The swap was quoted, so TACO could fill it then, and can't now since the market has moved.
        // Nothing has been pulled.
        if (!fillsSwap(plan)) {
            return {
                kind: "error",
                error: `No route can fill the swap (${plan.routeDescription})`,
                rateChanged: true,
            };
        }

        if (plan.legs.length === 1) {
            const args: Parameters<TacoExchangePoolService["swapMultiHopV2"]> = [
                inputToken,
                outputToken,
                grossAmountIn,
                plan.legs[0].route,
                minAmountOut,
            ];
            return this.handleResponse(this.service.swapMultiHopV2(...args), swapResponse, args);
        }

        const args: Parameters<TacoExchangePoolService["swapSplitRoutesV2"]> = [
            inputToken,
            outputToken,
            splitLegs(plan.legs, grossAmountIn),
            minAmountOut,
        ];
        return this.handleResponse(this.service.swapSplitRoutesV2(...args), swapResponse, args);
    }
}
