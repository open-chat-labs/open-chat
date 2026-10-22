import {
    CommonResponses,
    ErrorCode,
    type ManageNeuronResponse,
    type NeuronVoteFailureReason,
    type RegisterProposalVoteResponse,
} from "@shared";

const NNS_ERROR_TYPE_NEURON_ALREADY_VOTED = 19;

// A neuron the user can vote with, as listed by NNS or SNS governance
export type VotingNeuron<Id> = {
    id: Id;
    dissolveDelaySeconds: bigint;
};

// How voting with one neuron went: governance's response, or `call_failed` if the call itself
// failed (eg. a network error), so governance never saw it
export type NeuronVote = {
    neuronId: string;
    dissolveDelaySeconds: bigint;
    outcome: ManageNeuronResponse | { kind: "call_failed"; message: string };
};

type ManageNeuronError = Extract<ManageNeuronResponse, { kind: "error" }>;

type DissolveState = { DissolveDelaySeconds: bigint } | { WhenDissolvedTimestampSeconds: bigint };

// How long the neuron has left to dissolve, or undefined if governance didn't say
export function dissolveDelaySeconds(
    state: DissolveState | undefined,
    nowMillis: bigint,
): bigint | undefined {
    if (state === undefined) return undefined;
    if ("WhenDissolvedTimestampSeconds" in state) {
        const remaining = state.WhenDissolvedTimestampSeconds - nowMillis / BigInt(1000);
        return remaining > BigInt(0) ? remaining : BigInt(0);
    }
    return state.DissolveDelaySeconds;
}

// The neurons which are not dissolved, and so may be able to vote
export function notDissolved<Id>(
    neurons: { id: Id | undefined; dissolveState: DissolveState | undefined }[],
    nowMillis: bigint,
): VotingNeuron<Id>[] {
    return neurons.flatMap(({ id, dissolveState }) => {
        const delay = dissolveDelaySeconds(dissolveState, nowMillis);
        return id !== undefined && delay !== undefined && delay > BigInt(0)
            ? [{ id, dissolveDelaySeconds: delay }]
            : [];
    });
}

// The vote counts as cast if any neuron's vote is accepted, or if any neuron had already voted
// (eg. via the NNS dapp), so that the vote still gets recorded in OpenChat. Otherwise each neuron
// is returned with the reason its vote failed. `minimumSeconds` is governance's minimum dissolve
// delay to vote, used to explain why a neuron isn't eligible.
export function neuronVotesResponse(
    votes: NeuronVote[],
    isNns: boolean,
    minimumSeconds: bigint | undefined,
): RegisterProposalVoteResponse {
    const errors: { neuronId: string; dissolveDelaySeconds: bigint; error: ManageNeuronError }[] =
        [];
    let callFailures = 0;
    for (const { neuronId, dissolveDelaySeconds, outcome } of votes) {
        switch (outcome.kind) {
            case "success":
                return CommonResponses.success();
            case "call_failed":
                callFailures++;
                break;
            case "error":
                if (isAlreadyVoted(outcome, isNns)) return CommonResponses.success();
                errors.push({ neuronId, dissolveDelaySeconds, error: outcome });
                break;
        }
    }

    if (errors.some((e) => isNotAcceptingVotes(e.error))) {
        return { kind: "error", code: ErrorCode.ProposalNotAcceptingVotes, message: undefined };
    }

    // Nothing reached governance, so there's nothing to explain, just try again
    if (errors.length === 0 && callFailures > 0) {
        return { kind: "error", code: ErrorCode.Unknown, message: undefined };
    }

    return {
        kind: "neuron_votes_failed",
        failures: votes.map(({ neuronId, dissolveDelaySeconds, outcome }) => ({
            neuronId,
            reason: failureReason(outcome, dissolveDelaySeconds, minimumSeconds),
        })),
    };
}

// Whether the minimum dissolve delay to vote is needed to explain the failures
export function needsMinimumDissolveDelay(votes: NeuronVote[], isNns: boolean): boolean {
    return (
        neuronVotesResponse(votes, isNns, undefined).kind === "neuron_votes_failed" &&
        votes.some((v) => v.outcome.kind === "error" && isNotEligible(v.outcome))
    );
}

function failureReason(
    outcome: NeuronVote["outcome"],
    dissolveDelaySeconds: bigint,
    minimumSeconds: bigint | undefined,
): NeuronVoteFailureReason {
    switch (outcome.kind) {
        // Never reached, since any accepted vote counts as cast
        case "success":
        case "call_failed":
            return { kind: "call_failed" };
        case "error":
            if (!isNotEligible(outcome)) return { kind: "rejected", message: outcome.message };
            return minimumSeconds !== undefined && dissolveDelaySeconds < minimumSeconds
                ? { kind: "dissolve_delay_too_short", dissolveDelaySeconds, minimumSeconds }
                : { kind: "not_eligible" };
    }
}

// NNS governance has a dedicated error type for this, SNS governance reports it as a
// precondition failure, so fall back to the message both of them use
function isAlreadyVoted(error: ManageNeuronError, isNns: boolean): boolean {
    if (isNns && error.type === NNS_ERROR_TYPE_NEURON_ALREADY_VOTED) return true;
    return /already voted/i.test(error.message);
}

// Best effort: both canisters report a closed proposal as a precondition failure whose message
// mentions the deadline
function isNotAcceptingVotes(error: ManageNeuronError): boolean {
    return /deadline|not accepting votes/i.test(error.message);
}

// The neuron has no ballot, because it wasn't eligible when the proposal was submitted.
// SNS governance says "not eligible", NNS governance says "not authorized".
function isNotEligible(error: ManageNeuronError): boolean {
    return /not (eligible|authorized) to vote on proposal/i.test(error.message);
}
