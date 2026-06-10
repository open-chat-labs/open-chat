import type { ApiGetAllAMMPoolsResponse } from "./candid/idl";
import type { TokenSwapPool } from "openchat-shared";

// TACO is a single exchange canister that internally holds many AMM pools.
// Every TokenSwapPool we emit shares the same canisterId (the exchange) — OC's
// pool registry keys by (dex, canisterId, token0, token1) so this is fine.
export const TACO_EXCHANGE_CANISTER_ID = "qioex-5iaaa-aaaan-q52ba-cai";

export function getAllAMMPoolsResponse(candid: ApiGetAllAMMPoolsResponse): TokenSwapPool[] {
    return candid.map((p) => ({
        dex: "taco",
        canisterId: TACO_EXCHANGE_CANISTER_ID,
        token0: p.token0,
        token1: p.token1,
    }));
}
