import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import { idlFactory, type TacoExchangeIndexService } from "./candid/idl";
import { CandidCanisterAgent } from "../../../canisterAgent/candid";
import type { TokenSwapPool } from "@shared";
import { getAllAMMPoolsResponse, TACO_EXCHANGE_CANISTER_ID } from "./mappers";
import type { SwapIndexClient, SwapPoolClient } from "../../index";
import { TacoPoolClient } from "../pool/taco.pool.client";

export class TacoIndexClient
    extends CandidCanisterAgent<TacoExchangeIndexService>
    implements SwapIndexClient
{
    constructor(identity: Identity, agent: HttpAgent) {
        super(identity, agent, TACO_EXCHANGE_CANISTER_ID, idlFactory, "TacoExchangeIndex");
    }

    // TACO has only one exchange canister, so the canisterId argument is
    // ignored — every pool lives inside qioex-…-cai.
    getPoolClient(_canisterId: string, token0: string, token1: string): SwapPoolClient {
        return new TacoPoolClient(this.identity, this.agent, token0, token1);
    }

    getPools(): Promise<TokenSwapPool[]> {
        return this.handleQueryResponse(this.service.getAllAMMPools, getAllAMMPoolsResponse);
    }
}
