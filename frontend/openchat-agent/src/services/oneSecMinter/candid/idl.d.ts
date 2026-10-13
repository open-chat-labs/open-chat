import type { IDL } from "@icp-sdk/core/candid";

import {
    Chain,
    EvmChain,
    ForwardEvmToIcpArg,
    ForwardingResponse,
    Token,
    TransferFee,
    TransferIcpToEvmArg,
    TransferResponse,
    _SERVICE,
} from "./types";
export {
    Chain as ApiChain,
    EvmChain as ApiEvmChain,
    ForwardEvmToIcpArg as ApiForwardEvmToIcpArg,
    ForwardingResponse as ApiForwardingResponse,
    Token as ApiToken,
    TransferFee as ApiTransferFee,
    TransferIcpToEvmArg as ApiTransferIcpToEvmArg,
    TransferResponse as ApiTransferResponse,
    _SERVICE as OneSecMinterService,
};

export const idlFactory: IDL.InterfaceFactory;
