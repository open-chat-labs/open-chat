import type { ApiPairInfo } from "./candid/idl";
import type { TokenSwapPool } from "openchat-shared";
import { optional } from "../../../../utils/mapping";

export function getAllPairsResponse(candid: ApiPairInfo[], canisterId: string): TokenSwapPool[] {
    return candid.map((p) => ({
        dex: "sonic",
        canisterId,
        token0: p.token0,
        token1: p.token1,
    }));
}

export function getPairResponse(candid: [ApiPairInfo] | []): TokenPair | undefined {
    return optional(candid, pair);
}

function pair(candid: ApiPairInfo): TokenPair {
    return {
        token0: candid.token0,
        reserve0: candid.reserve0,
        token1: candid.token1,
        reserve1: candid.reserve1,
    };
}

export type TokenPair = {
    token0: string;
    reserve0: bigint;
    token1: string;
    reserve1: bigint;
};
