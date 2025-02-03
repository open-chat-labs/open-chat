import type { HttpAgent, Identity } from "@dfinity/agent";
import { idlFactory, type IcpSwapIndexService } from "./candid/idl";
import { CandidCanisterAgent } from "../../../canisterAgent/candid";
import type { TokenSwapPool } from "openchat-shared";
import { getPoolsResponse } from "./mappers";
import type { SwapIndexClient, SwapPoolClient } from "../../index";
import { IcpSwapPoolClient } from "../pool/icpSwap.pool.client";

const ICPSWAP_INDEX_CANISTER_ID = "4mmnk-kiaaa-aaaag-qbllq-cai";

export class IcpSwapIndexClient extends CandidCanisterAgent<IcpSwapIndexService> implements SwapIndexClient {
    constructor(identity: Identity, agent: HttpAgent) {
        super(identity, agent, ICPSWAP_INDEX_CANISTER_ID, idlFactory, "IcpSwapIndex");
    }

    getPoolClient(canisterId: string, token0: string, token1: string): SwapPoolClient {
        return new IcpSwapPoolClient(this.identity, this.agent, canisterId, token0, token1);
    }

    getPools(): Promise<TokenSwapPool[]> {
        return this.handleQueryResponse(this.service.getPools, getPoolsResponse);
    }
}
