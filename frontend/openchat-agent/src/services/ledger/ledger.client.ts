import type { Identity } from "@dfinity/agent";
import { idlFactory, LedgerService } from "./candid/idl";
import { CandidService } from "../candidService";
import type { ILedgerClient } from "./ledger.client.interface";
import type { Tokens } from "openchat-shared";
import type { AgentConfig } from "../../config";
import { Principal } from "@dfinity/principal";

export class LedgerClient extends CandidService implements ILedgerClient {
    private service: LedgerService;

    private constructor(identity: Identity, config: AgentConfig, canisterId: string) {
        super(identity);

        this.service = this.createServiceClient<LedgerService>(idlFactory, canisterId, config);
    }

    static create(identity: Identity, config: AgentConfig, canisterId: string): ILedgerClient {
        return new LedgerClient(identity, config, canisterId);
    }

    accountBalance(principal: string): Promise<Tokens> {
        return this.handleResponse(
            this.service.icrc1_balance_of({ owner: Principal.fromText(principal), subaccount: [] }),
            (e8s) => { return { e8s }; }
        );
    }
}
