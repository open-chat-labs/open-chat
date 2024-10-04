import type { HttpAgent, Identity } from "@dfinity/agent";
import { idlFactory, type SonicSwapsService } from "./candid/idl";
import { CandidService } from "../../../candidService";
import type { TokenSwapPool } from "openchat-shared";
import { getAllPairsResponse, getPairResponse } from "./mappers";
import { Principal } from "@dfinity/principal";
import type { SwapIndexClient, SwapPoolClient } from "../..";

const SONIC_INDEX_CANISTER_ID = "3xwpq-ziaaa-aaaah-qcn4a-cai";

export class SonicSwapsClient extends CandidService implements SwapIndexClient, SwapPoolClient {
    private service: SonicSwapsService;

    constructor(identity: Identity, agent: HttpAgent) {
        super(identity, agent, SONIC_INDEX_CANISTER_ID);

        this.service = this.createServiceClient<SonicSwapsService>(idlFactory);
    }

    getPoolClient(_canisterId: string, _token0: string, _token1: string): SwapPoolClient {
        return this;
    }

    getPools(): Promise<TokenSwapPool[]> {
        return this.handleQueryResponse(this.service.getAllPairs, (resp) =>
            getAllPairsResponse(resp, SONIC_INDEX_CANISTER_ID),
        );
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
