import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import { idlFactory, type TacoExchangePoolService } from "./candid/idl";
import { CandidCanisterAgent } from "../../../canisterAgent/candid";
import { optimalQuoteResponse } from "./mappers";
import type { SwapPoolClient } from "../../index";
import { TACO_EXCHANGE_CANISTER_ID } from "../index/mappers";

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
}
