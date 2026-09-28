import type { IDL } from "@icp-sdk/core/candid";
import { NatResult, UnusedBalanceResult, _SERVICE } from "./types";
export {
    NatResult as ApiNatResult,
    UnusedBalanceResult as ApiUnusedBalanceResult,
    _SERVICE as IcpSwapPoolService,
};

export const idlFactory: IDL.InterfaceFactory;
