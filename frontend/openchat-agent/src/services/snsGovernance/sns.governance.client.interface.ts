import type { ListNervousSystemFunctionsResponse, ManageNeuronResponse, ProposalVoteDetails } from "openchat-shared";

export interface ISnsGovernanceClient {
    registerVote(neuronId: string, proposalId: bigint, vote: boolean): Promise<ManageNeuronResponse>;
    getProposalVoteDetails(proposalId: bigint): Promise<ProposalVoteDetails>;
    listNervousSystemFunctions(): Promise<ListNervousSystemFunctionsResponse>;
}
