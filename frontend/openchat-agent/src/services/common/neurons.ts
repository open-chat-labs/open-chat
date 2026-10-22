// A neuron the user can vote with, as listed by NNS or SNS governance
export type VotingNeuron<Id> = {
    id: Id;
    dissolveDelaySeconds: bigint;
};

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
