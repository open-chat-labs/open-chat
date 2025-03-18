import type { HttpAgent, Identity } from "@dfinity/agent";
import type { Utxo } from "openchat-shared";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import { idlFactory, type BitcoinService } from "./candid/idl";
import { getUtxosResponse } from "./mappers";

const BITCOIN_CANISTER_ID = "ghsi2-tqaaa-aaaan-aaaca-cai";

export class BitcoinClient extends CandidCanisterAgent<BitcoinService> {
    private readonly network: { mainnet: null } | { testnet: null };

    constructor(identity: Identity, agent: HttpAgent, mainnetEnabled: boolean) {
        super(identity, agent, BITCOIN_CANISTER_ID, idlFactory, "BitcoinCanister");

        this.network = mainnetEnabled
            ? { mainnet: null }
            : { testnet: null };
    }

    getUtxos(address: string): Promise<Utxo[]> {
        return this.handleQueryResponse(
            () => this.service.bitcoin_get_utxos_query({
                network: this.network,
                address,
                filter: []
            }),
            getUtxosResponse,
        );
    }
}
