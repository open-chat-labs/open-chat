import {
    type PendingUtxo,
    UnsupportedValueError,
    type UpdateBtcBalanceResponse,
    type Utxo,
    type UtxoStatus,
} from "openchat-shared";
import type { ApiPendingUtxo, ApiUpdateBalanceError, ApiUtxo, ApiUtxoStatus } from "./candid/idl";
import { consolidateBytes, identity, optional } from "../../utils/mapping";

export function updateBtcBalanceResponse(
    candid: { Ok: Array<ApiUtxoStatus> } | { Err: ApiUpdateBalanceError },
): UpdateBtcBalanceResponse {
    if ("Ok" in candid) {
        return {
            kind: "success",
            result: candid.Ok.map(utxoStatus),
        };
    }
    return updateBtcBalanceError(candid.Err);
}

function updateBtcBalanceError(candid: ApiUpdateBalanceError): UpdateBtcBalanceResponse {
    if ("GenericError" in candid) {
        return {
            kind: "generic_error",
            errorMessage: candid.GenericError.error_message,
            errorCode: candid.GenericError.error_code,
        };
    }
    if ("TemporarilyUnavailable" in candid) {
        return {
            kind: "temporarily_unavailable",
            message: candid.TemporarilyUnavailable,
        };
    }
    if ("AlreadyProcessing" in candid) {
        return {
            kind: "already_processing",
        };
    }
    if ("NoNewUtxos" in candid) {
        return {
            kind: "no_new_utxos",
            requiredConfirmations: candid.NoNewUtxos.required_confirmations,
            pendingUtxos:
                optional(candid.NoNewUtxos.pending_utxos, (p) => p.map(pendingUtxo)) ?? [],
            currentConfirmations: optional(candid.NoNewUtxos.current_confirmations, identity),
        };
    }
    throw new UnsupportedValueError("Unexpected UpdateBtcBalanceResponse type received", candid);
}

function utxoStatus(candid: ApiUtxoStatus): UtxoStatus {
    if ("ValueTooSmall" in candid) {
        return {
            kind: "value_too_small",
            utxo: utxo(candid.ValueTooSmall),
        };
    }
    if ("Tainted" in candid) {
        return {
            kind: "tainted",
            utxo: utxo(candid.Tainted),
        };
    }
    if ("Minted" in candid) {
        return {
            kind: "minted",
            mintedAmount: candid.Minted.minted_amount,
            blockIndex: candid.Minted.block_index,
            utxo: utxo(candid.Minted.utxo),
        };
    }
    if ("Checked" in candid) {
        return {
            kind: "checked",
            utxo: utxo(candid.Checked),
        };
    }
    throw new UnsupportedValueError("Unexpected ApiUtxoStatus type received", candid);
}

function utxo(candid: ApiUtxo): Utxo {
    return {
        height: candid.height,
        value: candid.value,
        outpoint: outpoint(candid.outpoint),
    };
}

function pendingUtxo(candid: ApiPendingUtxo): PendingUtxo {
    return {
        confirmations: candid.confirmations,
        value: candid.value,
        outpoint: outpoint(candid.outpoint),
    };
}

function outpoint(candid: { txid: Uint8Array | number[]; vout: number }): {
    txid: Uint8Array;
    vout: number;
} {
    return {
        txid: consolidateBytes(candid.txid),
        vout: candid.vout,
    };
}
