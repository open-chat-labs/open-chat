import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import { Principal } from "@icp-sdk/core/principal";
import { idlFactory, type LedgerService } from "./candid/idl";
import { CandidCanisterAgent } from "../canisterAgent/candid";

export class LedgerClient extends CandidCanisterAgent<LedgerService> {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId, idlFactory, "Ledger");
    }

    accountBalance(principal: string): Promise<bigint> {
        return this.handleQueryResponse(
            () =>
                this.service.icrc1_balance_of({
                    owner: Principal.fromText(principal),
                    subaccount: [],
                }),
            (balance) => {
                return balance;
            },
        );
    }
}
