import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import { idlFactory, type TacoExchangePoolService } from "./candid/idl";
import { CandidCanisterAgent } from "../../../canisterAgent/candid";
import { quoteResponse } from "./mappers";
import type { SwapPoolClient } from "../../index";
import { TACO_EXCHANGE_CANISTER_ID } from "../index/mappers";

export class TacoPoolClient
    extends CandidCanisterAgent<TacoExchangePoolService>
    implements SwapPoolClient
{
    constructor(identity: Identity, agent: HttpAgent, _token0: string, _token1: string) {
        // TACO routes internally — the pool client doesn't need the token
        // ordering. Constructor signature is kept symmetric with ICPSwap's so
        // SwapIndexClient.getPoolClient remains polymorphic.
        super(identity, agent, TACO_EXCHANGE_CANISTER_ID, idlFactory, "TacoExchangePool");
    }

    quote(inputToken: string, outputToken: string, amountIn: bigint): Promise<bigint> {
        const args: [string, string, bigint] = [inputToken, outputToken, amountIn];
        return this.handleQueryResponse(
            () => this.service.getExpectedReceiveAmount(...args),
            quoteResponse,
            args,
        );
    }
}
