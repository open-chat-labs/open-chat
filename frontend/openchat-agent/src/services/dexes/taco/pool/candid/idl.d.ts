import type { IDL } from "@icp-sdk/core/candid";
import { OptimalSwapPlan, SplitLeg, SwapHop, SwapResult, _SERVICE } from "./types";
export {
    OptimalSwapPlan as ApiOptimalSwapPlan,
    SplitLeg as ApiSplitLeg,
    SwapHop as ApiSwapHop,
    SwapResult as ApiSwapResult,
    _SERVICE as TacoExchangePoolService,
};

export const idlFactory: IDL.InterfaceFactory;
