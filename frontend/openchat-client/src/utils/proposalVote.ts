import {
    ErrorCode,
    i18nKey,
    type NeuronVoteFailureReason,
    type ProposalVoteOutcome,
    type RegisterProposalVoteResponse,
    type ResourceKey,
} from "@shared";

const SECONDS_PER_DAY = 24 * 60 * 60;

function failed(key: string): ProposalVoteOutcome {
    return { kind: "failed", message: i18nKey(key) };
}

export function proposalVoteResult(resp: RegisterProposalVoteResponse): ProposalVoteOutcome {
    switch (resp.kind) {
        case "success":
            return { kind: "voted" };
        case "neuron_votes_failed":
            return {
                kind: "neuron_votes_failed",
                failures: resp.failures.map(({ neuronId, reason }) => ({
                    neuronId,
                    reason: neuronVoteFailureMessage(reason),
                })),
            };
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

function neuronVoteFailureMessage(reason: NeuronVoteFailureReason): ResourceKey {
    switch (reason.kind) {
        case "dissolve_delay_too_short":
            // Rounded so that the delay always reads as less than the minimum
            return i18nKey("proposal.neuronDissolveDelayTooShort", {
                delay: Math.floor(Number(reason.dissolveDelaySeconds) / SECONDS_PER_DAY),
                minimum: Math.ceil(Number(reason.minimumSeconds) / SECONDS_PER_DAY),
            });
        case "not_eligible":
            return i18nKey("proposal.neuronNotEligible");
        case "rejected":
            return i18nKey("proposal.neuronVoteRejected", { message: reason.message });
        default:
            return reason satisfies never;
    }
}
