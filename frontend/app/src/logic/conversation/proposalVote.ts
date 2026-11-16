import {
    neuronDashboardUrl,
    neuronLabel,
    proposalDashboardUrl,
    type ChatIdentifier,
    type Message,
    type OpenChat,
    type ProposalContent,
    type ProposalVoteOutcome,
    type ResourceKey,
} from "@client";
import { NamedNeurons } from "@src/stores/namedNeurons";

// Voting on a governance proposal in a proposals chat, and its page, for every tree that shows the
// proposal's card (logic/conversation/messageRow's).

/**
 * Why a vote didn't go through, as the old trees' card showed it in a dialog: no neuron the reader
 * can vote with (their OpenChat principal, to add to a neuron as a hotkey), or each of their
 * neurons that couldn't vote, with why.
 */
export type ProposalVoteProblem =
    | { kind: "no_eligible_neurons"; hotkey: string }
    | {
          kind: "neuron_votes_failed";
          failures: { neuronId: string; label: string; url: string; reason: ResourceKey }[];
      };

/** What a vote came to, for the view: nothing to say, a problem to show, or a failure to toast. */
export type ProposalVoteResult =
    | { kind: "done" }
    | { kind: "problem"; problem: ProposalVoteProblem }
    | { kind: "failed"; message: ResourceKey };

/**
 * The reader's vote on the proposal in `msg` (`voteOnProposal`, which shows it at once and refuses a
 * second one), and what to show if it didn't go through.
 */
export async function voteOnProposal(
    client: Pick<OpenChat, "voteOnProposal" | "tryGetNervousSystem" | "OcIdentityPrincipal">,
    chatId: ChatIdentifier,
    msg: Pick<Message, "messageId" | "messageIndex">,
    content: ProposalContent,
    adopt: boolean,
): Promise<ProposalVoteResult> {
    const outcome = await client.voteOnProposal(
        chatId,
        msg.messageIndex,
        msg.messageId,
        content,
        adopt,
    );
    return proposalVoteResult(outcome, content, client);
}

/** A vote's outcome as the view shows it (`voteOnProposal`'s). */
export function proposalVoteResult(
    outcome: ProposalVoteOutcome,
    content: ProposalContent,
    client: Pick<OpenChat, "tryGetNervousSystem" | "OcIdentityPrincipal">,
): ProposalVoteResult {
    switch (outcome.kind) {
        case "voted":
        case "skipped":
            return { kind: "done" };
        case "no_eligible_neurons":
            return {
                kind: "problem",
                problem: { kind: "no_eligible_neurons", hotkey: client.OcIdentityPrincipal },
            };
        case "neuron_votes_failed": {
            const nns = content.proposal.kind === "nns";
            const root = rootCanister(client, content);
            return {
                kind: "problem",
                problem: {
                    kind: "neuron_votes_failed",
                    failures: outcome.failures.map(({ neuronId, reason }) => ({
                        neuronId,
                        label: neuronLabel(neuronId, NamedNeurons),
                        url: neuronDashboardUrl(neuronId, nns, root),
                        reason,
                    })),
                },
            };
        }
        case "failed":
            return { kind: "failed", message: outcome.message };
    }
}

/** The proposal's page on the IC dashboard (its summary, payload and votes). */
export function proposalPage(
    client: Pick<OpenChat, "tryGetNervousSystem">,
    content: ProposalContent,
): string {
    return proposalDashboardUrl(content.proposal, rootCanister(client, content));
}

function rootCanister(
    client: Pick<OpenChat, "tryGetNervousSystem">,
    content: ProposalContent,
): string {
    return client.tryGetNervousSystem(content.governanceCanisterId)?.rootCanisterId ?? "";
}
