import type { IDL } from "@dfinity/candid";
import { get_utxos_request, get_utxos_response, utxo, _SERVICE } from "./types";
export {
    get_utxos_request as ApiGetUtxosRequest,
    get_utxos_response as ApiGetUtxosResponse,
    utxo as ApiUtxo,
    _SERVICE as BitcoinService,
};

export const idlFactory: IDL.InterfaceFactory;
