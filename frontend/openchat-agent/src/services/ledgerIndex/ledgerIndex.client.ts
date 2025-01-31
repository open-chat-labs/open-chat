import type { HttpAgent, Identity } from "@dfinity/agent";
import { idlFactory, type LedgerIndexService } from "./candid/idl";
import { CanisterAgent } from "../canisterAgent";
import { Principal } from "@dfinity/principal";
import { accountTransactions } from "./mappers";
import type { AccountTransactionResult } from "openchat-shared";
import { apiOptional } from "../common/chatMappers";
import { identity } from "../../utils/mapping";

export class LedgerIndexClient extends CanisterAgent {
    private service: LedgerIndexService;

    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId);

        this.service = this.createServiceClient<LedgerIndexService>(idlFactory);
    }

    getAccountTransactions(principal: string, fromId?: bigint): Promise<AccountTransactionResult> {
        return this.handleQueryResponse(
            () =>
                this.service.get_account_transactions({
                    max_results: 100n,
                    start: apiOptional(identity, fromId),
                    account: { owner: Principal.fromText(principal), subaccount: [] },
                }),
            accountTransactions,
        );
    }
}

// Here are some fake transactions that can be used for testing ...

// function nanosToDate(n: bigint): Date {
//     return new Date(Number(n / 1_000_000n));
// }

// const fake: AccountTransactionResult = {
//     kind: "success",
//     transactions: [
//         {
//             id: 138564n,
//             kind: "transfer",
//             timestamp: nanosToDate(1697552025392673986n),
//             memo: "OC_MSG",
//             createdAt: nanosToDate(1697552019815000000n),
//             amount: 100000n,
//             fee: 100000n,
//             to: "cgpjn-omaaa-aaaaa-qaakq-cai",
//             from: "cpmcr-yeaaa-aaaaa-qaala-cai",
//         },
//         {
//             id: 128503n,
//             kind: "transfer",
//             timestamp: nanosToDate(1696327482080010244n),
//             createdAt: nanosToDate(1696327473845000000n),
//             amount: 50000000n,
//             fee: 100000n,
//             to: "cgpjn-omaaa-aaaaa-qaakq-cai",
//             from: "cpmcr-yeaaa-aaaaa-qaala-cai",
//         },
//         {
//             id: 127837n,
//             kind: "transfer",
//             timestamp: nanosToDate(1696265754013069897n),
//             createdAt: nanosToDate(1696265749487000000n),
//             amount: 100000000n,
//             fee: 100000n,
//             to: "cgpjn-omaaa-aaaaa-qaakq-cai",
//             from: "cpmcr-yeaaa-aaaaa-qaala-cai",
//         },
//         {
//             id: 125464n,
//             kind: "transfer",
//             timestamp: nanosToDate(1695739529582317081n),
//             createdAt: nanosToDate(1695739525038085446n),
//             amount: 176899063n,
//             fee: 100000n,
//             to: "cpmcr-yeaaa-aaaaa-qaala-cai",
//             from: "cgpjn-omaaa-aaaaa-qaakq-cai",
//         },
//         {
//             id: 125449n,
//             kind: "transfer",
//             timestamp: nanosToDate(1695737069245451916n),
//             createdAt: nanosToDate(1695737065548632757n),
//             amount: 7075963n,
//             fee: 100000n,
//             to: "cpmcr-yeaaa-aaaaa-qaala-cai",
//             from: "cgpjn-omaaa-aaaaa-qaakq-cai",
//         },
//         {
//             id: 125411n,
//             kind: "transfer",
//             timestamp: nanosToDate(1695725448930037799n),
//             createdAt: nanosToDate(1695725444893331578n),
//             amount: 70759625n,
//             fee: 100000n,
//             to: "cpmcr-yeaaa-aaaaa-qaala-cai",
//             from: "cgpjn-omaaa-aaaaa-qaakq-cai",
//         },
//         {
//             id: 138564n,
//             kind: "transfer",
//             timestamp: nanosToDate(1697552025392673986n),
//             memo: "OC_MSG",
//             createdAt: nanosToDate(1697552019815000000n),
//             amount: 100000n,
//             fee: 100000n,
//             to: "cgpjn-omaaa-aaaaa-qaakq-cai",
//             from: "cpmcr-yeaaa-aaaaa-qaala-cai",
//         },
//         {
//             id: 128503n,
//             kind: "transfer",
//             timestamp: nanosToDate(1696327482080010244n),
//             createdAt: nanosToDate(1696327473845000000n),
//             amount: 50000000n,
//             fee: 100000n,
//             to: "cgpjn-omaaa-aaaaa-qaakq-cai",
//             from: "cpmcr-yeaaa-aaaaa-qaala-cai",
//         },
//         {
//             id: 127837n,
//             kind: "transfer",
//             timestamp: nanosToDate(1696265754013069897n),
//             createdAt: nanosToDate(1696265749487000000n),
//             amount: 100000000n,
//             fee: 100000n,
//             to: "cgpjn-omaaa-aaaaa-qaakq-cai",
//             from: "cpmcr-yeaaa-aaaaa-qaala-cai",
//         },
//         {
//             id: 125464n,
//             kind: "transfer",
//             timestamp: nanosToDate(1695739529582317081n),
//             createdAt: nanosToDate(1695739525038085446n),
//             amount: 176899063n,
//             fee: 100000n,
//             to: "cpmcr-yeaaa-aaaaa-qaala-cai",
//             from: "cgpjn-omaaa-aaaaa-qaakq-cai",
//         },
//         {
//             id: 125449n,
//             kind: "transfer",
//             timestamp: nanosToDate(1695737069245451916n),
//             createdAt: nanosToDate(1695737065548632757n),
//             amount: 7075963n,
//             fee: 100000n,
//             to: "cpmcr-yeaaa-aaaaa-qaala-cai",
//             from: "cgpjn-omaaa-aaaaa-qaakq-cai",
//         },
//         {
//             id: 125411n,
//             kind: "transfer",
//             timestamp: nanosToDate(1695725448930037799n),
//             createdAt: nanosToDate(1695725444893331578n),
//             amount: 70759625n,
//             fee: 100000n,
//             to: "cpmcr-yeaaa-aaaaa-qaala-cai",
//             from: "cgpjn-omaaa-aaaaa-qaakq-cai",
//         },
//     ],
//     oldestTransactionId: 125411n,
// };
