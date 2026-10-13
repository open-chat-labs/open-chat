import {
    ErrorCode,
    i18nKey,
    type ProposalVoteOutcome,
    type RegisterProposalVoteResponse,
} from "@shared";

function failed(key: string): ProposalVoteOutcome {
    return { kind: "failed", message: i18nKey(key) };
}

export function proposalVoteResult(resp: RegisterProposalVoteResponse): ProposalVoteOutcome {
    switch (resp.kind) {
        case "success":
            return { kind: "voted" };
        case "error":
            switch (resp.code) {
                case ErrorCode.NoEligibleNeurons:
                    return { kind: "no_eligible_neurons" };
                case ErrorCode.NoChange:
                    return failed("proposal.alreadyVoted");
                case ErrorCode.ProposalNotAcceptingVotes:
                    return failed("proposal.proposalNotAcceptingVotes");
                default:
                    return failed("proposal.voteFailed");
            }
        case "offline":
        case "failure":
            return failed("proposal.voteFailed");
        default:
            return resp satisfies never;
    }
}
