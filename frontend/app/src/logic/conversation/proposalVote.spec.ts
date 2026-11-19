import {
    i18nKey,
    type NervousSystemDetails,
    type OpenChat,
    type ProposalContent,
    type ProposalVoteOutcome,
} from "@client";
import { describe, expect, test, vi } from "vitest";
import { proposalPage, proposalVoteResult, voteOnProposal } from "./proposalVote";

const content = (kind: "nns" | "sns") =>
    ({
        kind: "proposal_content",
        governanceCanisterId: "gov",
        proposal: { kind, id: 5n },
    }) as ProposalContent;

const client: Pick<OpenChat, "OcIdentityPrincipal" | "tryGetNervousSystem"> = {
    OcIdentityPrincipal: "principal-1",
    tryGetNervousSystem: () => ({ rootCanisterId: "root" }) as NervousSystemDetails,
};

describe("a vote on a proposal", () => {
    test("says nothing once voted, or when there was nothing to send", () => {
        expect(proposalVoteResult({ kind: "voted" }, content("nns"), client)).toEqual({
            kind: "done",
        });
        expect(proposalVoteResult({ kind: "skipped" }, content("nns"), client)).toEqual({
            kind: "done",
        });
    });

    test("with no neuron to vote with, gives the principal to add as a hotkey", () => {
        expect(proposalVoteResult({ kind: "no_eligible_neurons" }, content("nns"), client)).toEqual(
            {
                kind: "problem",
                problem: { kind: "no_eligible_neurons", hotkey: "principal-1" },
            },
        );
    });

    test("lists each neuron that couldn't vote, with why, linked on the dashboard", () => {
        const reason = i18nKey("proposal.neuronNotEligible");
        const result = proposalVoteResult(
            { kind: "neuron_votes_failed", failures: [{ neuronId: "0123456789abcdef", reason }] },
            content("sns"),
            client,
        );
        expect(result).toEqual({
            kind: "problem",
            problem: {
                kind: "neuron_votes_failed",
                failures: [
                    {
                        neuronId: "0123456789abcdef",
                        label: "0123..cdef",
                        url: "https://dashboard.internetcomputer.org/sns/root/neuron/0123456789abcdef",
                        reason,
                    },
                ],
            },
        });
    });

    test("that failed says so", () => {
        const message = i18nKey("proposal.voteFailed");
        expect(proposalVoteResult({ kind: "failed", message }, content("nns"), client)).toEqual({
            kind: "failed",
            message,
        });
    });

    test("goes to the client with the message's index and id", async () => {
        const voteOnProposalSpy = vi.fn(
            async (): Promise<ProposalVoteOutcome> => ({ kind: "voted" }),
        );
        const voting = { ...client, voteOnProposal: voteOnProposalSpy };
        const chatId = { kind: "group_chat", groupId: "g" } as const;
        const proposal = content("nns");
        await voteOnProposal(voting, chatId, { messageId: 9n, messageIndex: 3 }, proposal, true);
        expect(voteOnProposalSpy).toHaveBeenCalledWith(chatId, 3, 9n, proposal, true);
    });
});

describe("a proposal's page", () => {
    test("is on the IC dashboard, an SNS one under its root canister", () => {
        expect(proposalPage(client, content("nns"))).toBe(
            "https://dashboard.internetcomputer.org/proposal/5",
        );
        expect(proposalPage(client, content("sns"))).toBe(
            "https://dashboard.internetcomputer.org/sns/root/proposal/5",
        );
    });
});
