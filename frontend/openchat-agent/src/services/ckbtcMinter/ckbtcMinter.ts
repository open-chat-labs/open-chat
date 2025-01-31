import type { HttpAgent, Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import type { UpdateBtcBalanceResponse } from "openchat-shared";
import { idlFactory, type CkbtcMinterService } from "./candid/idl";
import { CanisterAgent } from "../canisterAgent";
import { updateBtcBalanceResponse } from "./mappers";
import { apiOptional } from "../common/chatMappers";

const CKBTC_MINTER_CANISTER_ID = "mqygn-kiaaa-aaaar-qaadq-cai";

export class CkbtcMinterClient extends CanisterAgent {
    private service: CkbtcMinterService;

    constructor(identity: Identity, agent: HttpAgent) {
        super(identity, agent, CKBTC_MINTER_CANISTER_ID);

        this.service = this.createServiceClient<CkbtcMinterService>(idlFactory);
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
