import type { HttpAgent, Identity } from "@dfinity/agent";
import { idlFactory, type IcpSwapIndexService } from "./candid/idl";
import { CandidService } from "../../../candidService";
import type { TokenSwapPool } from "openchat-shared";
import { getPoolsResponse } from "./mappers";

const ICPSWAP_INDEX_CANISTER_ID = "4mmnk-kiaaa-aaaag-qbllq-cai";
const TEN_MINUTES = 10 * 60 * 1000;

export class IcpSwapIndexClient extends CandidService {
    private service: IcpSwapIndexService;
    private pools: TokenSwapPool[] = []; // Cache the pools for 10 minutes
    private poolsLastUpdated: number = 0;

    constructor(identity: Identity, agent: HttpAgent) {
        super(identity, agent, ICPSWAP_INDEX_CANISTER_ID);

        this.service = this.createServiceClient<IcpSwapIndexService>(idlFactory);
    }

    async getPools(): Promise<TokenSwapPool[]> {
        const now = Date.now();
        if (this.pools.length > 0 && now - this.poolsLastUpdated < TEN_MINUTES)
            return Promise.resolve(this.pools);

        const pools = await this.handleQueryResponse(this.service.getPools, getPoolsResponse);

        this.poolsLastUpdated = now;
        return (this.pools = pools);
    }
}
