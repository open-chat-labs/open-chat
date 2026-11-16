import {
    ProposalDecisionStatus,
    type Proposal,
    type ProposalContent,
    type ReadonlyMap,
    type Tally,
} from "@shared";
import type { ProposalVoteStatus } from "../stores/proposalVotes";

// How a governance proposal in a proposals chat shows, for every tree: its links on the IC
// dashboard, its proposer, its type, whether it's critical, its tally and the reader's vote.

export const IC_DASHBOARD_URL = "https://dashboard.internetcomputer.org";

/** A proposal on the IC dashboard: an NNS one by its id, an SNS one under its root canister. */
export function proposalDashboardUrl(proposal: Proposal, rootCanisterId: string): string {
    return proposal.kind === "nns"
        ? `${IC_DASHBOARD_URL}/proposal/${proposal.id}`
        : `${IC_DASHBOARD_URL}/sns/${rootCanisterId}/proposal/${proposal.id}`;
}

/** A neuron on the IC dashboard, as `proposalDashboardUrl`. */
export function neuronDashboardUrl(neuronId: string, nns: boolean, rootCanisterId: string): string {
    return nns
        ? `${IC_DASHBOARD_URL}/neuron/${neuronId}`
        : `${IC_DASHBOARD_URL}/sns/${rootCanisterId}/neuron/${neuronId}`;
}

/** A neuron by its name where it has one (`named`, the known teams' neurons), else its id shortened. */
export function neuronLabel(neuronId: string, named: Readonly<Record<string, string>>): string {
    const name = named[neuronId];
    if (name !== undefined) return name;
    if (neuronId.length < 12) return neuronId;
    return `${neuronId.slice(0, 4)}..${neuronId.slice(neuronId.length - 4)}`;
}

/** A proposal's type: its NNS topic or its SNS action, by the chat's names for them ("unknown"). */
export function proposalTopicLabel(
    content: ProposalContent,
    topics: ReadonlyMap<number, string>,
): string {
    const proposal = content.proposal;
    return topics.get(proposal.kind === "nns" ? proposal.topic : proposal.action) ?? "unknown";
}

// The SNS actions that are critical, and need more votes to pass: transfer treasury funds,
// deregister dapp canisters, mint SNS tokens. Keep in step with the SNS governance's.
const CRITICAL_SNS_ACTIONS: ReadonlySet<number> = new Set([9, 11, 12]);

/** Whether a proposal is critical (an SNS's treasury, dapp or minting action). */
export function isCriticalProposal(proposal: Proposal): boolean {
    return proposal.kind === "sns" && CRITICAL_SNS_ACTIONS.has(proposal.action);
}

/** A side's share of the voting power, as a percentage to two places (0 with no voting power). */
export function proposalVotePercent(votes: number, tally: Pick<Tally, "total">): number {
    if (tally.total <= 0) return 0;
    return Math.round((10_000 * votes) / tally.total) / 100;
}

/** The reader's vote: one cast this session (on its way or counted), else the one the proposal says. */
export function proposalVoteStatus(
    cast: ProposalVoteStatus | undefined,
    myVote: boolean | undefined,
): ProposalVoteStatus | undefined {
    if (cast !== undefined) return cast;
    return myVote === undefined ? undefined : myVote ? "adopted" : "rejected";
}

/** How a proposal's decision reads: still open, adopted, executed, rejected, or failed in execution. */
export type ProposalOutcome = "open" | "adopted" | "executed" | "rejected" | "failed";

export function proposalOutcome(status: ProposalDecisionStatus): ProposalOutcome {
    switch (status) {
        case ProposalDecisionStatus.Open:
            return "open";
        case ProposalDecisionStatus.Adopted:
            return "adopted";
        case ProposalDecisionStatus.Executed:
            return "executed";
        case ProposalDecisionStatus.Failed:
            return "failed";
        case ProposalDecisionStatus.Rejected:
        case ProposalDecisionStatus.Unspecified:
            return "rejected";
    }
}
