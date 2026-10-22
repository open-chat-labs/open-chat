import { describe, expect, test } from "vitest";
import type { ApiListNeuronsResponse } from "./candid/idl";
import { minimumDissolveDelayToVoteSeconds, votingNeurons } from "./mappers";

const NOW = BigInt(1_000_000) * BigInt(1000);

describe("SNS votingNeurons", () => {
    test("keeps the subaccounts and dissolve delays of neurons which are not dissolved", () => {
        const resp: ApiListNeuronsResponse = {
            neurons: [
                {
                    id: [{ id: [1, 2, 3] }],
                    dissolve_state: [{ DissolveDelaySeconds: BigInt(100) }],
                },
                {
                    id: [{ id: new Uint8Array([4, 5]) }],
                    dissolve_state: [{ WhenDissolvedTimestampSeconds: BigInt(1_000_001) }],
                },
            ],
        };
        expect(votingNeurons(resp, NOW)).toEqual([
            { id: new Uint8Array([1, 2, 3]), dissolveDelaySeconds: BigInt(100) },
            { id: new Uint8Array([4, 5]), dissolveDelaySeconds: BigInt(1) },
        ]);
    });

    test("drops neurons which are dissolved or have no id", () => {
        const resp: ApiListNeuronsResponse = {
            neurons: [
                { id: [{ id: [1] }], dissolve_state: [{ DissolveDelaySeconds: BigInt(0) }] },
                {
                    id: [{ id: [2] }],
                    dissolve_state: [{ WhenDissolvedTimestampSeconds: BigInt(999_999) }],
                },
                { id: [{ id: [3] }], dissolve_state: [] },
                { id: [], dissolve_state: [{ DissolveDelaySeconds: BigInt(100) }] },
            ],
        };
        expect(votingNeurons(resp, NOW)).toEqual([]);
    });
});

describe("SNS minimumDissolveDelayToVoteSeconds", () => {
    test("reads the minimum from the nervous system parameters", () => {
        expect(
            minimumDissolveDelayToVoteSeconds({
                neuron_minimum_dissolve_delay_to_vote_seconds: [BigInt(2_629_800)],
            }),
        ).toBe(BigInt(2_629_800));
        expect(
            minimumDissolveDelayToVoteSeconds({
                neuron_minimum_dissolve_delay_to_vote_seconds: [],
            }),
        ).toBeUndefined();
    });
});
