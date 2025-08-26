import {
    type Utxo,
} from "openchat-shared";
import type { ApiGetUtxosResponse, ApiUtxo } from "./candid/idl";
import { consolidateBytes } from "../../utils/mapping";

export function getUtxosResponse(
    candid: ApiGetUtxosResponse,
): Utxo[] {
    return candid.utxos.map(utxo);
}

export function utxo(candid: ApiUtxo): Utxo {
    return {
        height: candid.height,
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
