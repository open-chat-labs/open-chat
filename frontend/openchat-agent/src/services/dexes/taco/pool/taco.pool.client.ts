import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import type { DexSwapResult } from "@shared";
import { idlFactory, type TacoExchangePoolService } from "./candid/idl";
import { CandidCanisterAgent } from "../../../canisterAgent/candid";
import { optimalQuoteResponse, splitLegs, swapResponse } from "./mappers";
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

    quote(inputToken: string, outputToken: string, amountIn: bigint): Promise<bigint> {
        // Single canister call: TACO runs the BatchMulti probe grid AND the
        // split-route optimizer internally and returns just the optimal output.
        // No local optimizer needed — the canister is the source of truth.
        if (amountIn === 0n) return Promise.resolve(0n);
        const args: [string, string, bigint] = [inputToken, outputToken, amountIn];
        return this.handleQueryResponse(
            () => this.service.getExpectedReceiveAmountBatchMultiOptimal(...args),
            optimalQuoteResponse,
            args,
        );
    }

    // Whether TACO accepts swaps straight from the wallet with this input token. TACO enables these
    // token by token, and can switch them off altogether.
    async canSwapFromWallet(inputToken: string): Promise<boolean> {
        const [enabled, allowedTokens] = await Promise.all([
            this.handleQueryResponse(() => this.service.getV2Enabled(), identity),
            this.handleQueryResponse(() => this.service.getV2AllowedTokens(), identity),
        ]);
        return enabled && allowedTokens.includes(inputToken);
    }

    // What TACO pulls from the wallet to swap `amountIn`, ie. `amountIn` plus TACO's trading fee and
    // the input token's transfer fee
    grossAmountIn(inputToken: string, amountIn: bigint): Promise<bigint> {
        const args: [string, bigint] = [inputToken, amountIn];
        return this.handleQueryResponse(() => this.service.netToGrossV2(...args), identity, args);
    }

    // The allowance the wallet must grant TACO's exchange canister for it to pull `grossAmountIn`,
    // which covers the fee the ledger charges for the pull
    requiredAllowance(inputToken: string, grossAmountIn: bigint): Promise<bigint> {
        const args: [string, bigint] = [inputToken, grossAmountIn];
        return this.handleQueryResponse(
            () => this.service.requiredAllowanceV2(...args),
            identity,
            args,
        );
    }

    // Swaps `amountIn` straight from the caller's wallet, following the plan TACO picks for it, which
    // may split the swap across several routes. TACO pulls `grossAmountIn` from the wallet via ICRC2,
    // so the caller must first get it from `grossAmountIn` and approve the exchange canister for
    // `requiredAllowance(inputToken, grossAmountIn)`. It is passed in rather than looked up again so
    // the amount pulled is the amount approved. TACO queues the output's transfer back to the wallet,
    // so it can land a few seconds after this returns. A failed swap can still have moved funds, eg.
    // a SlippageExceeded one settles on chain and a SystemError one leaves a pending pull, which TACO
    // tracks, so balances should be read again after an error.
    async swapFromWallet(
        inputToken: string,
        outputToken: string,
        amountIn: bigint,
        grossAmountIn: bigint,
        minAmountOut: bigint,
    ): Promise<DexSwapResult> {
        const planArgs: [string, string, bigint] = [inputToken, outputToken, amountIn];
        const plan = await this.handleQueryResponse(
            () => this.service.getExpectedReceiveAmountBatchMultiOptimal(...planArgs),
            identity,
            planArgs,
        );

        if (plan.legs.length === 0) {
            return { kind: "error", error: `No route available (${plan.routeDescription})` };
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
