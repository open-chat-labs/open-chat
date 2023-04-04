import type { ProposalVoteDetails } from "openchat-shared";

export interface INnsGovernanceClient {
    getProposalVoteDetails(proposalId: bigint): Promise<ProposalVoteDetails>;
}
