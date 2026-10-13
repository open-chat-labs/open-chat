import type { IDL } from "@icp-sdk/core/candid";
import {
    PendingUtxo,
    RetrieveBtcWithApprovalError,
    UpdateBalanceError,
    Utxo,
    UtxoStatus,
    _SERVICE,
} from "./types";
export {
    PendingUtxo as ApiPendingUtxo,
    RetrieveBtcWithApprovalError as ApiRetrieveBtcWithApprovalError,
    UpdateBalanceError as ApiUpdateBalanceError,
    Utxo as ApiUtxo,
    UtxoStatus as ApiUtxoStatus,
    _SERVICE as CkbtcMinterService,
};

export const idlFactory: IDL.InterfaceFactory;
