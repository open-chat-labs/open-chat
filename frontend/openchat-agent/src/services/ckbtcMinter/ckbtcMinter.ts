import type { HttpAgent, Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import { idlFactory, type CkbtcMinterService } from "./candid/idl";
import { utxo } from "../bitcoin/mappers";
import type { Utxo } from "openchat-shared";

const MAINNET_CKBTC_MINTER_CANISTER_ID = "mqygn-kiaaa-aaaar-qaadq-cai";
const TESTNET_CKBTC_MINTER_CANISTER_ID = "ml52i-qqaaa-aaaar-qaaba-cai";

export class CkbtcMinterClient extends CandidCanisterAgent<CkbtcMinterService> {
    constructor(identity: Identity, agent: HttpAgent, mainnetEnabled: boolean) {
        super(
            identity,
            agent,
            mainnetEnabled ? MAINNET_CKBTC_MINTER_CANISTER_ID : TESTNET_CKBTC_MINTER_CANISTER_ID,
            idlFactory,
            "CkbtcMinter"
        );
    }

    getKnownUtxos(userId: string): Promise<Utxo[]> {
        return this.handleQueryResponse(
            () => this.service.get_known_utxos({
                owner: [Principal.fromText(userId)],
                subaccount: [],
            }),
            (resp) => resp.map(utxo),
        )
    }
}
