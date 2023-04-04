import type { ListNervousSystemFunctionsResponse, ProposalVoteDetails } from "openchat-shared";

export interface ISnsGovernanceClient {
    getProposalVoteDetails(proposalId: bigint): Promise<ProposalVoteDetails>;
    listNervousSystemFunctions(): Promise<ListNervousSystemFunctionsResponse>;
}
