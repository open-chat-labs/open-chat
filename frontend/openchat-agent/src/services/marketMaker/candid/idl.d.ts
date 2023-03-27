import type { IDL } from "@dfinity/candid";
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
