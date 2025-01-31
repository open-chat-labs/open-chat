import type { HttpAgent, Identity } from "@dfinity/agent";
import { idlFactory, type LedgerService } from "./candid/idl";
import { CanisterAgent } from "../canisterAgent";
import { Principal } from "@dfinity/principal";

export class LedgerClient extends CanisterAgent {
    private service: LedgerService;

    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId);

        this.service = this.createServiceClient<LedgerService>(idlFactory);
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
