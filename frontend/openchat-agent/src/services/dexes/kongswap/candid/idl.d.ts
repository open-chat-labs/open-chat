import type { IDL } from "@icp-sdk/core/candid";
import { SwapAmountsResult, TokensResult, _SERVICE } from "./types";
export {
    SwapAmountsResult as ApiSwapAmountsResult,
    TokensResult as ApiTokensResult,
    _SERVICE as KongSwapService,
};

export const idlFactory: IDL.InterfaceFactory;
