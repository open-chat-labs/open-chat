<!-- Why a vote on a proposal didn't go through, as the old trees' proposal card said it: no neuron
     the reader can vote with (their OpenChat principal, to add as a hotkey, with a copy button), or
     each of their neurons that couldn't vote, with why (linked to it on the IC dashboard). Then
     where to read more.
     TODO(design): the design has no dialog for either. -->
<script lang="ts">
    import CopyButton from "@openchat/ui/src/lib/components/CopyButton.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import { interpolate } from "@i18n/i18n";
    import Markdown from "@src/core/Markdown.svelte";
    import type { ProposalVoteProblem } from "@src/logic/conversation/proposalVote";
    import { _ } from "svelte-i18n";

    interface Props {
        problem: ProposalVoteProblem;
        onClose: () => void;
    }

    let { problem, onClose }: Props = $props();
</script>

<DialogShell
    title={$_(
        problem.kind === "no_eligible_neurons"
            ? "proposal.noEligibleNeurons"
            : "proposal.neuronVotesFailed",
    )}
    width={440}
    height="auto"
    {onClose}>
    <div class="body">
        {#if problem.kind === "no_eligible_neurons"}
            <Markdown text={$_("proposal.noEligibleNeuronsPrincipalIntro")} />
            <div class="hotkey">
                <span class="label">{$_("proposal.noEligibleNeuronsPrincipalLabel")}</span>
                <span class="value">
                    <code>{problem.hotkey}</code>
                    <CopyButton value={problem.hotkey} label={$_("copyToClipboard")} size="sm" />
                </span>
            </div>
        {:else}
            <p>{$_("proposal.neuronVotesFailedIntro")}</p>
            <ul class="failures">
                {#each problem.failures as failure (failure.neuronId)}
                    <li>
                        <a href={failure.url} target="_blank" rel="noreferrer">{failure.label}</a>
                        <span class="reason">{interpolate($_, failure.reason)}</span>
                    </li>
                {/each}
            </ul>
        {/if}
        <Markdown text={$_("proposal.noEligibleNeuronsMoreInfo")} />
    </div>
</DialogShell>

<style lang="scss">
    .body {
        display: flex;
        flex-direction: column;
        gap: var(--space-14);
        font: var(--weight-regular) var(--text-base) / 1.45 var(--font-sans);
        color: var(--ink-2);

        p {
            margin: 0;
        }

        :global(.markdown-wrapper p) {
            margin: 0;
        }
    }

    .hotkey {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
    }

    .label {
        font: var(--weight-medium) var(--text-sm) / 1.3 var(--font-sans);
        color: var(--ink-3);
    }

    .value {
        display: flex;
        align-items: center;
        gap: var(--space-8);

        code {
            min-width: 0;
            overflow-wrap: anywhere;
            font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-mono);
            color: var(--ink);
        }
    }

    .failures {
        margin: 0;
        padding-inline-start: var(--space-18);
        display: flex;
        flex-direction: column;
        gap: var(--space-8);

        a {
            color: var(--accent);
        }
    }

    .reason {
        display: block;
        font-size: var(--text-sm);
        color: var(--ink-3);
    }
</style>
