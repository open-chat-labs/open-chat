import type { IDL } from "@icp-sdk/core/candid";
import { OptimalSwapPlan, SplitLeg, SwapResult, _SERVICE } from "./types";
export {
    OptimalSwapPlan as ApiOptimalSwapPlan,
    SplitLeg as ApiSplitLeg,
    SwapResult as ApiSwapResult,
    _SERVICE as TacoExchangePoolService,
};

export const idlFactory: IDL.InterfaceFactory;
