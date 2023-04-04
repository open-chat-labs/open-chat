import type { ManageNeuronResponse, ProposalVoteDetails } from "openchat-shared";

export interface INnsGovernanceClient {
    registerVote(neuronId: string, proposalId: bigint, vote: boolean): Promise<ManageNeuronResponse>;
    getProposalVoteDetails(proposalId: bigint): Promise<ProposalVoteDetails>;
}
