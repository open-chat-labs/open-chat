import type { Identity } from "@dfinity/agent";
import { idlFactory, type SonicSwapsService } from "./candid/idl";
import { CandidService } from "../../../candidService";
import type { AgentConfig } from "../../../../config";
import type { TokenSwapPool } from "openchat-shared";
import { getAllPairsResponse, getPairResponse } from "./mappers";
import { Principal } from "@dfinity/principal";

const SONIC_INDEX_CANISTER_ID = "3xwpq-ziaaa-aaaah-qcn4a-cai";
const TEN_MINUTES = 10 * 60 * 1000;
const ENABLED: boolean = true;

export class SonicSwapsClient extends CandidService {
    private service: SonicSwapsService;
    private pools: TokenSwapPool[] = []; // Cache the pools for 10 minutes
    private poolsLastUpdated: number = 0;

    private constructor(identity: Identity, config: AgentConfig) {
        super(identity);

        this.service = this.createServiceClient<SonicSwapsService>(
            idlFactory,
            SONIC_INDEX_CANISTER_ID,
            config,
        );
    }

    static create(identity: Identity, config: AgentConfig): SonicSwapsClient {
        return new SonicSwapsClient(identity, config);
    }

    async getPools(): Promise<TokenSwapPool[]> {
        if (!ENABLED) return Promise.resolve([]);

        const now = Date.now();
        if (this.pools.length > 0 && now - this.poolsLastUpdated < TEN_MINUTES)
            return Promise.resolve(this.pools);

        const pools = await this.handleQueryResponse(this.service.getAllPairs, (resp) =>
            getAllPairsResponse(resp, SONIC_INDEX_CANISTER_ID),
        );

        this.poolsLastUpdated = now;
        return (this.pools = pools);
    }

    async quote(inputToken: string, outputToken: string, amountIn: bigint): Promise<bigint> {
        const pair = await this.handleQueryResponse(
            () =>
                this.service.getPair(
                    Principal.fromText(inputToken),
                    Principal.fromText(outputToken),
                ),
            getPairResponse,
        );
        if (pair === undefined) return BigInt(0);

        const zeroForOne = pair.token0 === inputToken;
        const reserveIn = zeroForOne ? pair.reserve0 : pair.reserve1;
        const reserveOut = zeroForOne ? pair.reserve1 : pair.reserve0;

        const amountInWithFee = amountIn * BigInt(997);
        const numerator = amountInWithFee * reserveOut;
        const denominator = reserveIn * BigInt(1000) + amountInWithFee;
        return numerator / denominator;
    }
}
