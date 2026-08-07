import type { IDL } from "@icp-sdk/core/candid";
import {
    _SERVICE,
    UpdateConfigArgs,
    UpdateConfigResponse,
} from "./types";
export {
    _SERVICE as MarketMakerService,
    UpdateConfigArgs as ApiUpdateConfigArgs,
    UpdateConfigResponse as ApiUpdateConfigResponse,
};

export const idlFactory: IDL.InterfaceFactory;
