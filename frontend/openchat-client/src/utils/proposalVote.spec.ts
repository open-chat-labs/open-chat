import { describe, expect, test } from "vitest";
import { proposalVoteResult } from "./proposalVote";

const DAY = BigInt(24 * 60 * 60);

describe("proposalVoteResult", () => {
    test("lists each neuron that couldn't vote with its reason", () => {
        expect(
            proposalVoteResult({
                kind: "neuron_votes_failed",
                failures: [
                    {
                        neuronId: "a",
                        reason: {
                            kind: "dissolve_delay_too_short",
                            dissolveDelaySeconds: BigInt(13) * DAY + BigInt(2100),
                            minimumSeconds: BigInt(2_629_800),
                        },
                    },
                    { neuronId: "b", reason: { kind: "not_eligible" } },
                    { neuronId: "c", reason: { kind: "rejected", message: "Neuron is locked" } },
                ],
            }),
        ).toEqual({
            kind: "neuron_votes_failed",
            failures: [
                {
                    neuronId: "a",
                    reason: expect.objectContaining({
                        key: "proposal.neuronDissolveDelayTooShort",
                        params: { delay: 13, minimum: 31 },
                    }),
                },
                {
                    neuronId: "b",
                    reason: expect.objectContaining({ key: "proposal.neuronNotEligible" }),
                },
                {
                    neuronId: "c",
                    reason: expect.objectContaining({
                        key: "proposal.neuronVoteRejected",
                        params: { message: "Neuron is locked" },
                    }),
                },
            ],
        });
    });

    // A delay just under the minimum mustn't round up to read the same as it
    test("rounds the delay down and the minimum up", () => {
        const outcome = proposalVoteResult({
            kind: "neuron_votes_failed",
            failures: [
                {
                    neuronId: "a",
                    reason: {
                        kind: "dissolve_delay_too_short",
                        dissolveDelaySeconds: BigInt(30) * DAY - BigInt(1),
                        minimumSeconds: BigInt(30) * DAY,
                    },
                },
            ],
        });
        expect(outcome).toEqual({
            kind: "neuron_votes_failed",
            failures: [
                {
                    neuronId: "a",
                    reason: expect.objectContaining({ params: { delay: 29, minimum: 30 } }),
                },
            ],
        });
    });
});
