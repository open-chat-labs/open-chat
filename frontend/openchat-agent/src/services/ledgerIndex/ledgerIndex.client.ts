import type { Identity } from "@dfinity/agent";
import { idlFactory, type LedgerIndexService } from "./candid/idl";
import { CandidService } from "../candidService";
import type { AgentConfig } from "../../config";
import { Principal } from "@dfinity/principal";
import { accountTransactions } from "./mappers";
import type { AccountTransactionResult } from "openchat-shared";
import { apiOptional } from "../common/chatMappers";
import { identity } from "../../utils/mapping";

export class LedgerIndexClient extends CandidService {
    private service: LedgerIndexService;

    private constructor(identity: Identity, config: AgentConfig, canisterId: string) {
        super(identity);

        this.service = this.createServiceClient<LedgerIndexService>(idlFactory, canisterId, config);
    }

    static create(identity: Identity, config: AgentConfig, canisterId: string): LedgerIndexClient {
        return new LedgerIndexClient(identity, config, canisterId);
    }

    getAccountTransactions(principal: string, fromId?: bigint): Promise<AccountTransactionResult> {
        return this.handleResponse(
            this.service.get_account_transactions({
                max_results: 100n,
                start: apiOptional(identity, fromId),
                account: { owner: Principal.fromText(principal), subaccount: [] },
            }),
            accountTransactions,
        );
    }
}
