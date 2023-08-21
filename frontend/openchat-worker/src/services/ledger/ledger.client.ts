import type { Identity } from "@dfinity/agent";
import { idlFactory, type LedgerService } from "./candid/idl";
import { CandidService } from "../candidService";
import type { AgentConfig } from "../../config";
import { Principal } from "@dfinity/principal";

export class LedgerClient extends CandidService {
    private service: LedgerService;

    private constructor(identity: Identity, config: AgentConfig, canisterId: string) {
        super(identity);

        this.service = this.createServiceClient<LedgerService>(idlFactory, canisterId, config);
    }

    static create(identity: Identity, config: AgentConfig, canisterId: string): LedgerClient {
        return new LedgerClient(identity, config, canisterId);
    }

    accountBalance(principal: string): Promise<bigint> {
        return this.handleResponse(
            this.service.icrc1_balance_of({ owner: Principal.fromText(principal), subaccount: [] }),
            (balance) => {
                return balance;
            }
        );
    }
}
