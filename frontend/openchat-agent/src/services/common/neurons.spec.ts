import { ErrorCode } from "@shared";
import { describe, expect, test } from "vitest";
import { type NeuronVote, needsMinimumDissolveDelay, neuronVotesResponse } from "./neurons";

// The messages NNS and SNS governance return from `manage_neuron`
const SNS_NOT_ELIGIBLE = "Neuron not eligible to vote on proposal.";
const NNS_NOT_ELIGIBLE = "Neuron not authorized to vote on proposal.";
const NNS_CALLER_NOT_AUTHORIZED = "Caller is not authorized to vote for neuron.";
const SNS_CALLER_NOT_AUTHORIZED =
    "Caller 'aaaaa-aa' is not authorized to perform action: 'Vote' on neuron '01'.";
const ALREADY_VOTED = "Neuron already voted on proposal.";
const DEADLINE_PASSED = "Proposal deadline has passed.";

const DAY = BigInt(24 * 60 * 60);
const MINIMUM = BigInt(30) * DAY;

function vote(
    neuronId: string,
    outcome: NeuronVote["outcome"],
    dissolveDelaySeconds = BigInt(13) * DAY,
): NeuronVote {
    return { neuronId, dissolveDelaySeconds, outcome };
}

function error(message: string, type = 0): NeuronVote["outcome"] {
    return { kind: "error", type, message };
}

describe("neuronVotesResponse", () => {
    test("counts as cast if any neuron's vote is accepted or had already voted", () => {
        expect(
            neuronVotesResponse(
                [vote("a", error(SNS_NOT_ELIGIBLE)), vote("b", { kind: "success" })],
                false,
                MINIMUM,
            ),
        ).toEqual({ kind: "success" });
        expect(
            neuronVotesResponse(
                [vote("a", error(SNS_NOT_ELIGIBLE)), vote("b", error(ALREADY_VOTED))],
                false,
                MINIMUM,
            ),
        ).toEqual({ kind: "success" });
        expect(neuronVotesResponse([vote("a", error("anything", 19))], true, MINIMUM)).toEqual({
            kind: "success",
        });
    });

    test("a closed proposal is reported as not accepting votes", () => {
        expect(
            neuronVotesResponse(
                [vote("a", error(SNS_NOT_ELIGIBLE)), vote("b", error(DEADLINE_PASSED))],
                false,
                MINIMUM,
            ),
        ).toEqual({ kind: "error", code: ErrorCode.ProposalNotAcceptingVotes, message: undefined });
    });

    test("calls which all failed to reach governance are reported as a plain failure", () => {
        expect(
            neuronVotesResponse(
                [
                    vote("a", { kind: "call_failed", message: "timed out" }),
                    vote("b", { kind: "call_failed", message: "timed out" }),
                ],
                false,
                MINIMUM,
            ),
        ).toEqual({ kind: "error", code: ErrorCode.Unknown, message: undefined });
    });

    test("lists each neuron with the reason its vote failed", () => {
        expect(
            neuronVotesResponse(
                [
                    vote("short", error(SNS_NOT_ELIGIBLE)),
                    vote("nns-short", error(NNS_NOT_ELIGIBLE)),
                    vote("long", error(SNS_NOT_ELIGIBLE), BigInt(60) * DAY),
                    vote("sns-hotkey", error(SNS_CALLER_NOT_AUTHORIZED)),
                    vote("nns-hotkey", error(NNS_CALLER_NOT_AUTHORIZED)),
                    vote("unreachable", { kind: "call_failed", message: "timed out" }),
                ],
                false,
                MINIMUM,
            ),
        ).toEqual({
            kind: "neuron_votes_failed",
            failures: [
                {
                    neuronId: "short",
                    reason: {
                        kind: "dissolve_delay_too_short",
                        dissolveDelaySeconds: BigInt(13) * DAY,
                        minimumSeconds: MINIMUM,
                    },
                },
                {
                    neuronId: "nns-short",
                    reason: {
                        kind: "dissolve_delay_too_short",
                        dissolveDelaySeconds: BigInt(13) * DAY,
                        minimumSeconds: MINIMUM,
                    },
                },
                { neuronId: "long", reason: { kind: "not_eligible" } },
                {
                    neuronId: "sns-hotkey",
                    reason: { kind: "rejected", message: SNS_CALLER_NOT_AUTHORIZED },
                },
                {
                    neuronId: "nns-hotkey",
                    reason: { kind: "rejected", message: NNS_CALLER_NOT_AUTHORIZED },
                },
                { neuronId: "unreachable", reason: { kind: "call_failed" } },
            ],
        });
    });

    test("an ineligible neuron is just not eligible when the minimum is unknown", () => {
        expect(neuronVotesResponse([vote("a", error(SNS_NOT_ELIGIBLE))], false, undefined)).toEqual(
            {
                kind: "neuron_votes_failed",
                failures: [{ neuronId: "a", reason: { kind: "not_eligible" } }],
            },
        );
    });
});

describe("needsMinimumDissolveDelay", () => {
    test("only when an ineligible neuron's failure will be listed", () => {
        expect(needsMinimumDissolveDelay([vote("a", error(SNS_NOT_ELIGIBLE))], false)).toBe(true);
        expect(
            needsMinimumDissolveDelay(
                [vote("a", error(SNS_NOT_ELIGIBLE)), vote("b", { kind: "success" })],
                false,
            ),
        ).toBe(false);
        expect(
            needsMinimumDissolveDelay(
                [vote("a", error(SNS_NOT_ELIGIBLE)), vote("b", error(DEADLINE_PASSED))],
                false,
            ),
        ).toBe(false);
        expect(
            needsMinimumDissolveDelay([vote("a", error(SNS_CALLER_NOT_AUTHORIZED))], false),
        ).toBe(false);
    });
});
