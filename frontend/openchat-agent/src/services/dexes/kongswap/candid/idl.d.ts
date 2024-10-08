import type { IDL } from "@dfinity/candid";
import { SwapAmountsResult, TokensResult, _SERVICE } from "./types";
export {
    SwapAmountsResult as ApiSwapAmountsResult,
    TokensResult as ApiTokensResult,
    _SERVICE as KongSwapService,
};

export const idlFactory: IDL.InterfaceFactory;
