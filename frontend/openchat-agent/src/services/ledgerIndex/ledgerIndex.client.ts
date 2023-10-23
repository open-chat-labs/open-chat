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
        return Promise.resolve(fake);
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

function nanosToDate(n: bigint): Date {
    return new Date(Number(n / 1_000_000n));
}

const fake: AccountTransactionResult = {
    kind: "success",
    transactions: [
        {
            id: 138564n,
            kind: "transfer",
            timestamp: nanosToDate(1697552025392673986n),
            memo: "OC_MSG",
            createdAt: nanosToDate(1697552019815000000n),
            amount: 100000n,
            fee: 100000n,
            to: "cgpjn-omaaa-aaaaa-qaakq-cai",
            from: "cpmcr-yeaaa-aaaaa-qaala-cai",
        },
        {
            id: 128503n,
            kind: "transfer",
            timestamp: nanosToDate(1696327482080010244n),
            createdAt: nanosToDate(1696327473845000000n),
            amount: 50000000n,
            fee: 100000n,
            to: "cgpjn-omaaa-aaaaa-qaakq-cai",
            from: "cpmcr-yeaaa-aaaaa-qaala-cai",
        },
        {
            id: 127837n,
            kind: "transfer",
            timestamp: nanosToDate(1696265754013069897n),
            createdAt: nanosToDate(1696265749487000000n),
            amount: 100000000n,
            fee: 100000n,
            to: "cgpjn-omaaa-aaaaa-qaakq-cai",
            from: "cpmcr-yeaaa-aaaaa-qaala-cai",
        },
        {
            id: 125464n,
            kind: "transfer",
            timestamp: nanosToDate(1695739529582317081n),
            createdAt: nanosToDate(1695739525038085446n),
            amount: 176899063n,
            fee: 100000n,
            to: "cpmcr-yeaaa-aaaaa-qaala-cai",
            from: "cgpjn-omaaa-aaaaa-qaakq-cai",
        },
        {
            id: 125449n,
            kind: "transfer",
            timestamp: nanosToDate(1695737069245451916n),
            createdAt: nanosToDate(1695737065548632757n),
            amount: 7075963n,
            fee: 100000n,
            to: "cpmcr-yeaaa-aaaaa-qaala-cai",
            from: "cgpjn-omaaa-aaaaa-qaakq-cai",
        },
        {
            id: 125411n,
            kind: "transfer",
            timestamp: nanosToDate(1695725448930037799n),
            createdAt: nanosToDate(1695725444893331578n),
            amount: 70759625n,
            fee: 100000n,
            to: "cpmcr-yeaaa-aaaaa-qaala-cai",
            from: "cgpjn-omaaa-aaaaa-qaakq-cai",
        },
    ],
    oldestTransactionId: 125411n,
};
