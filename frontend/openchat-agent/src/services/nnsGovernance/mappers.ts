import type { ApiListProposalInfoResponse } from "./candid/idl";
import type { ProposalVoteDetails } from "openchat-shared";
import { proposalVote } from "../common/chatMappers";

const E8S_AS_BIGINT = BigInt(100_000_000);

export function getProposalVoteDetails(
    candid: ApiListProposalInfoResponse
): ProposalVoteDetails {
    const proposal = candid.proposal_info[0];
    if (proposal === undefined) {
        throw new Error("GetProposal returned an empty response");
    }
        const ballots = proposal.ballots;
        const tally = proposal.latest_tally[0]!;
        return {
            id: proposal.id[0]!.id,
            ballots: ballots.map(([n, b]) => ({
                neuronId: n.toString(),
                vote: proposalVote(b.vote),
                votingPower: b.voting_power,
            })),
            latestTally: {
                yes: Number(tally.yes / E8S_AS_BIGINT),
                no: Number(tally.no / E8S_AS_BIGINT),
                total: Number(tally.total / E8S_AS_BIGINT),
                timestamp: tally.timestamp_seconds * BigInt(1000)
            }
        };
}
