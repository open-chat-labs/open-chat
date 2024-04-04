import type { Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import type { UpdateBtcBalanceResponse } from "openchat-shared";
import { idlFactory, type CkbtcMinterService } from "./candid/idl";
import { CandidService } from "../candidService";
import { updateBtcBalanceResponse } from "./mappers";
import type { AgentConfig } from "../../config";
import { apiOptional } from "../common/chatMappers";

const CKBTC_MINTER_CANISTER_ID = "mqygn-kiaaa-aaaar-qaadq-cai";

export class CkbtcMinterClient extends CandidService {
    private service: CkbtcMinterService;

    private constructor(identity: Identity, config: AgentConfig) {
        super(identity);

        this.service = this.createServiceClient<CkbtcMinterService>(
            idlFactory,
            CKBTC_MINTER_CANISTER_ID,
            config,
        );
    }

    static create(identity: Identity, config: AgentConfig): CkbtcMinterClient {
        return new CkbtcMinterClient(identity, config);
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
