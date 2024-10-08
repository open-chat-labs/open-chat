import type { HttpAgent, Identity } from "@dfinity/agent";
import { idlFactory, type KongSwapService } from "./candid/idl";
import { CandidService } from "../../candidService";
import type { TokenSwapPool } from "openchat-shared";
import { swapAmountsResponse, tokensResponse } from "./mappers";
import type { SwapIndexClient, SwapPoolClient } from "../index";

const KONG_SWAP_CANISTER_ID = "3xwpq-ziaaa-aaaah-qcn4a-cai";

export class KongSwapClient extends CandidService implements SwapIndexClient, SwapPoolClient {
    private service: KongSwapService;

    constructor(identity: Identity, agent: HttpAgent) {
        super(identity, agent, KONG_SWAP_CANISTER_ID);

        this.service = this.createServiceClient<KongSwapService>(idlFactory);
    }

    getPoolClient(_canisterId: string, _token0: string, _token1: string): SwapPoolClient {
        return this;
    }

    async getPools(): Promise<TokenSwapPool[]> {
        const tokens = await this.handleQueryResponse(
            () => this.service.tokens([]),
            tokensResponse,
        );

        const pools: TokenSwapPool[] = [];
        for (let i = 0; i < tokens.length - 1; i++) {
            for (let j = i + 1; j < tokens.length; j++) {
                pools.push({
                    dex: "kongswap",
                    canisterId: KONG_SWAP_CANISTER_ID,
                    token0: tokens[i],
                    token1: tokens[j],
                });
            }
        }
        return pools;
    }

    quote(inputToken: string, outputToken: string, amountIn: bigint): Promise<bigint> {
        return this.handleQueryResponse(
            () => this.service.swap_amounts(`IC.${inputToken}`, amountIn, `IC.${outputToken}`),
            swapAmountsResponse,
        );
    }
}
