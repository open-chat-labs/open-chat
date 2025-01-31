import type { HttpAgent, Identity } from "@dfinity/agent";
import { idlFactory, type IcpLedgerIndexService } from "./candid/idl";
import { CanisterAgent } from "../canisterAgent";
import { Principal } from "@dfinity/principal";
import { accountTransactions } from "./mappers";
import type { AccountTransactionResult } from "openchat-shared";
import { apiOptional } from "../common/chatMappers";
import { identity } from "../../utils/mapping";

export class IcpLedgerIndexClient extends CanisterAgent {
    private service: IcpLedgerIndexService;

    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId, "IcpLedgerIndex");

        this.service = this.createServiceClient<IcpLedgerIndexService>(idlFactory);
    }

    getAccountTransactions(principal: string, fromId?: bigint): Promise<AccountTransactionResult> {
        return this.handleQueryResponse(
            () =>
                this.service.get_account_transactions({
                    max_results: 100n,
                    start: apiOptional(identity, fromId),
                    account: { owner: Principal.fromText(principal), subaccount: [] },
                }),
            "get_account_transactions",
            accountTransactions,
        );
    }
}
