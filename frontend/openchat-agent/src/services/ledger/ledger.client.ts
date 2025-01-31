import type { HttpAgent, Identity } from "@dfinity/agent";
import { idlFactory, type LedgerService } from "./candid/idl";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import { Principal } from "@dfinity/principal";

export class LedgerClient extends CandidCanisterAgent<LedgerService> {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId, idlFactory);
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
