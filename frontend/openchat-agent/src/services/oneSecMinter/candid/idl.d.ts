import type { IDL } from "@dfinity/candid";

import {
    Chain,
    EvmChain,
    ForwardEvmToIcpArg,
    ForwardingResponse,
    Token,
    TransferFee,
    _SERVICE,
} from "./types";
export {
    Chain as ApiChain,
    EvmChain as ApiEvmChain,
    ForwardEvmToIcpArg as ApiForwardEvmToIcpArg,
    ForwardingResponse as ApiForwardingResponse,
    Token as ApiToken,
    TransferFee as ApiTransferFee,
    _SERVICE as OneSecMinterService,
};

export const idlFactory: IDL.InterfaceFactory;
