import { describe, expect, test } from "vitest";
import type { ApiListNeuronsResponse } from "./candid/idl";
import { minimumDissolveDelayToVoteSeconds, votingNeurons } from "./mappers";

const NOW = BigInt(1_000_000) * BigInt(1000);

function response(neurons: ApiListNeuronsResponse["full_neurons"]): ApiListNeuronsResponse {
    return { full_neurons: neurons, total_pages_available: [BigInt(1)] };
}

describe("NNS votingNeurons", () => {
    test("keeps neurons which are not dissolved, with their dissolve delays", () => {
        const resp = response([
            { id: [{ id: BigInt(1) }], dissolve_state: [{ DissolveDelaySeconds: BigInt(100) }] },
            {
                id: [{ id: BigInt(2) }],
                dissolve_state: [{ WhenDissolvedTimestampSeconds: BigInt(1_000_001) }],
            },
        ]);
        expect(votingNeurons(resp, NOW)).toEqual([
            { id: "1", dissolveDelaySeconds: BigInt(100) },
            { id: "2", dissolveDelaySeconds: BigInt(1) },
        ]);
    });

    test("drops neurons which are dissolved or have no id", () => {
        const resp = response([
            { id: [{ id: BigInt(1) }], dissolve_state: [{ DissolveDelaySeconds: BigInt(0) }] },
            {
                id: [{ id: BigInt(2) }],
                dissolve_state: [{ WhenDissolvedTimestampSeconds: BigInt(999_999) }],
            },
            { id: [{ id: BigInt(3) }], dissolve_state: [] },
            { id: [], dissolve_state: [{ DissolveDelaySeconds: BigInt(100) }] },
        ]);
        expect(votingNeurons(resp, NOW)).toEqual([]);
    });
});

describe("NNS minimumDissolveDelayToVoteSeconds", () => {
    test("reads the minimum from the voting power economics", () => {
        expect(
            minimumDissolveDelayToVoteSeconds({
                voting_power_economics: [
                    { neuron_minimum_dissolve_delay_to_vote_seconds: [BigInt(15_778_800)] },
                ],
            }),
        ).toBe(BigInt(15_778_800));
        expect(minimumDissolveDelayToVoteSeconds({ voting_power_economics: [] })).toBeUndefined();
    });
});
