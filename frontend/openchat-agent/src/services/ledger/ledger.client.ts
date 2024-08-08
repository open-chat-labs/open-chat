import type { HttpAgent, Identity } from "@dfinity/agent";
import { idlFactory, type LedgerService } from "./candid/idl";
import { CandidService } from "../candidService";
import { Principal } from "@dfinity/principal";

export class LedgerClient extends CandidService {
    private service: LedgerService;

    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent);

        this.service = this.createServiceClient<LedgerService>(idlFactory, canisterId);
    }

    accountBalance(principal: string): Promise<bigint> {
        return this.handleResponse(
            this.service.icrc1_balance_of({ owner: Principal.fromText(principal), subaccount: [] }),
            (balance) => {
                return balance;
            },
        );
    }
}
