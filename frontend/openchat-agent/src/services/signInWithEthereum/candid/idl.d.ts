import type { IDL } from "@dfinity/candid";
import { GetDelegationResponse, LoginResponse, PrepareLoginResponse, _SERVICE } from "./types";
export {
    GetDelegationResponse as ApiGetDelegationResponse,
    LoginResponse as ApiLoginResponse,
    PrepareLoginResponse as ApiPrepareLoginResponse,
    _SERVICE as SignInWithEthereumService,
};

export const idlFactory: IDL.InterfaceFactory;
