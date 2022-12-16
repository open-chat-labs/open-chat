import type { ListNervousSystemFunctionsResponse, Tally } from "openchat-shared";

export interface ISnsGovernanceClient {
    getTally(proposalId: bigint): Promise<Tally>;
    listNervousSystemFunctions(): Promise<ListNervousSystemFunctionsResponse>;
}
