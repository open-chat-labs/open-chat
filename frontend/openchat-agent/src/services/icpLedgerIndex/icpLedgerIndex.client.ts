import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import { idlFactory, type IcpLedgerIndexService } from "./candid/idl";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import { userIdToApiIcrcAccount } from "../../utils/icrcAccount";
import { accountTransactions } from "./mappers";
import type { AccountTransactionResult } from "@shared";
import { apiOptional } from "../common/chatMappers";
import { identity } from "../../utils/mapping";

export class IcpLedgerIndexClient extends CandidCanisterAgent<IcpLedgerIndexService> {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId, idlFactory, "IcpLedgerIndex");
    }

    getAccountTransactions(userId: string, fromId?: bigint): Promise<AccountTransactionResult> {
        return this.handleQueryResponse(
            () =>
                this.service.get_account_transactions({
                    max_results: 100n,
                    start: apiOptional(identity, fromId),
                    account: userIdToApiIcrcAccount(userId),
                }),
            accountTransactions,
        );
    }
}
