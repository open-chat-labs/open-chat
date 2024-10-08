import type { ApiSwapAmountsResult, ApiTokensResult } from "./candid/idl";

export function tokensResponse(candid: ApiTokensResult): string[] {
    const tokens = [];
    if ("Ok" in candid) {
        for (const token of candid.Ok) {
            if ("IC" in token && token.IC.on_kong) {
                tokens.push(token.IC.canister_id);
            }
        }
    }
    return tokens;
}

export function swapAmountsResponse(candid: ApiSwapAmountsResult): bigint {
    return "Ok" in candid ? candid.Ok.receive_amount : BigInt(0);
}
