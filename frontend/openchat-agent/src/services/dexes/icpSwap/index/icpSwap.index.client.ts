import type { HttpAgent, Identity } from "@dfinity/agent";
import { idlFactory, type IcpSwapIndexService } from "./candid/idl";
import { CanisterAgent } from "../../../canisterAgent";
import type { TokenSwapPool } from "openchat-shared";
import { getPoolsResponse } from "./mappers";
import type { SwapIndexClient, SwapPoolClient } from "../../index";
import { IcpSwapPoolClient } from "../pool/icpSwap.pool.client";

const ICPSWAP_INDEX_CANISTER_ID = "4mmnk-kiaaa-aaaag-qbllq-cai";

export class IcpSwapIndexClient extends CanisterAgent implements SwapIndexClient {
    private service: IcpSwapIndexService;

    constructor(identity: Identity, agent: HttpAgent) {
        super(identity, agent, ICPSWAP_INDEX_CANISTER_ID);

        this.service = this.createServiceClient<IcpSwapIndexService>(idlFactory);
    }

    getPoolClient(canisterId: string, token0: string, token1: string): SwapPoolClient {
        return new IcpSwapPoolClient(this.identity, this.agent, canisterId, token0, token1);
    }

    getPools(): Promise<TokenSwapPool[]> {
        return this.handleQueryResponse(this.service.getPools, getPoolsResponse);
    }
}
