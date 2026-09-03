import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import { idlFactory, type LedgerService } from "./candid/idl";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import { userIdToApiIcrcAccount } from "../../utils/icrcAccount";

export class LedgerClient extends CandidCanisterAgent<LedgerService> {
    constructor(identity: Identity, agent: HttpAgent) {
        super(identity, agent, undefined, idlFactory, "Ledger");
    }

    accountBalance(ledger: string, userId: string): Promise<bigint> {
        return this.handleQueryResponse(
            () =>
                this.service.icrc1_balance_of.withOptions({ canisterId: ledger })(
                    userIdToApiIcrcAccount(userId),
                ),
            (balance) => {
                return balance;
            },
        );
    }
}
