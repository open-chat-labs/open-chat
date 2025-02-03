import type { HttpAgent, Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import type { UpdateBtcBalanceResponse } from "openchat-shared";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import { idlFactory, type CkbtcMinterService } from "./candid/idl";
import { updateBtcBalanceResponse } from "./mappers";
import { apiOptional } from "../common/chatMappers";

const CKBTC_MINTER_CANISTER_ID = "mqygn-kiaaa-aaaar-qaadq-cai";

export class CkbtcMinterClient extends CandidCanisterAgent<CkbtcMinterService> {
    constructor(identity: Identity, agent: HttpAgent) {
        super(identity, agent, CKBTC_MINTER_CANISTER_ID, idlFactory, "CkbtcMinter");
    }

    updateBalance(userId: string): Promise<UpdateBtcBalanceResponse> {
        return this.handleResponse(
            this.service.update_balance({
                owner: apiOptional((u) => Principal.fromText(u), userId),
                subaccount: [],
            }),
            updateBtcBalanceResponse,
        );
    }
}
