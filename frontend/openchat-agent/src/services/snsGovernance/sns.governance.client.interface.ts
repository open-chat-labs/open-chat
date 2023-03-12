import type { ListNervousSystemFunctionsResponse, Tally } from "openchat-shared";

export interface ISnsGovernanceClient {
    getProposalTally(proposalId: bigint): Promise<Tally>;
    listNervousSystemFunctions(): Promise<ListNervousSystemFunctionsResponse>;
}
