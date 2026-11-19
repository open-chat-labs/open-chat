import { ProposalDecisionStatus, type Proposal, type ProposalContent } from "@shared";
import { describe, expect, test } from "vitest";
import {
    isCriticalProposal,
    neuronDashboardUrl,
    neuronLabel,
    proposalDashboardUrl,
    proposalOutcome,
    proposalTopicLabel,
    proposalVotePercent,
    proposalVoteStatus,
} from "./proposalCard";

const nns = { kind: "nns", id: 42n, topic: 4 } as Proposal;
const sns = { kind: "sns", id: 7n, action: 9 } as Proposal;

describe("a proposal's card", () => {
    test("links an NNS proposal by its id and an SNS one under its root canister", () => {
        expect(proposalDashboardUrl(nns, "")).toBe(
            "https://dashboard.internetcomputer.org/proposal/42",
        );
        expect(proposalDashboardUrl(sns, "root")).toBe(
            "https://dashboard.internetcomputer.org/sns/root/proposal/7",
        );
        expect(neuronDashboardUrl("n1", true, "")).toBe(
            "https://dashboard.internetcomputer.org/neuron/n1",
        );
        expect(neuronDashboardUrl("n1", false, "root")).toBe(
            "https://dashboard.internetcomputer.org/sns/root/neuron/n1",
        );
    });

    test("names a known neuron, and shortens any other's id", () => {
        const named = { abcdef0123456789: "Dev Team" };
        expect(neuronLabel("abcdef0123456789", named)).toBe("Dev Team");
        expect(neuronLabel("0123456789abcdef", named)).toBe("0123..cdef");
        expect(neuronLabel("short", named)).toBe("short");
    });

    test("names its type by its NNS topic or SNS action, else unknown", () => {
        const topics = new Map([
            [4, "Governance"],
            [9, "Transfer treasury funds"],
        ]);
        const content = (proposal: Proposal) => ({ proposal }) as ProposalContent;
        expect(proposalTopicLabel(content(nns), topics)).toBe("Governance");
        expect(proposalTopicLabel(content(sns), topics)).toBe("Transfer treasury funds");
        expect(proposalTopicLabel(content(nns), new Map())).toBe("unknown");
    });

    test("is critical for an SNS's treasury, dapp and minting actions only", () => {
        expect(isCriticalProposal(sns)).toBe(true);
        expect(isCriticalProposal({ ...sns, action: 1 } as Proposal)).toBe(false);
        expect(isCriticalProposal(nns)).toBe(false);
    });

    test("gives each side's share of the voting power to two places, none without any", () => {
        expect(proposalVotePercent(1, { total: 3 })).toBe(33.33);
        expect(proposalVotePercent(5, { total: 0 })).toBe(0);
    });

    test("takes the vote cast this session over the proposal's own", () => {
        expect(proposalVoteStatus("adopting", false)).toBe("adopting");
        expect(proposalVoteStatus(undefined, false)).toBe("rejected");
        expect(proposalVoteStatus(undefined, true)).toBe("adopted");
        expect(proposalVoteStatus(undefined, undefined)).toBeUndefined();
    });

    test("reads its decision as the old trees colour it", () => {
        expect(proposalOutcome(ProposalDecisionStatus.Open)).toBe("open");
        expect(proposalOutcome(ProposalDecisionStatus.Adopted)).toBe("adopted");
        expect(proposalOutcome(ProposalDecisionStatus.Executed)).toBe("executed");
        expect(proposalOutcome(ProposalDecisionStatus.Failed)).toBe("failed");
        expect(proposalOutcome(ProposalDecisionStatus.Rejected)).toBe("rejected");
        expect(proposalOutcome(ProposalDecisionStatus.Unspecified)).toBe("rejected");
    });
});
