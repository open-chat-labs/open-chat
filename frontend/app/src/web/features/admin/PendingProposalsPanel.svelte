<!-- The operator console's Pending operator proposals tab (the old `PendingOperatorProposals`):
     each dual authorized action awaiting a second operator, with Confirm (not the proposer's own:
     the canister refuses it) and Reject (anyone). TODO(design): no design; plain cards. -->
<script lang="ts">
    import type { ResourceKey, UserSummary } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import {
        formatProposalTimestamp,
        isOwnProposal,
        proposerName,
        type PendingProposals,
    } from "@src/logic/admin/pendingProposals.svelte";
    import { onMount } from "svelte";
    import type { ConsoleReport } from "./console";

    interface Props {
        proposals: PendingProposals;
        currentUserId: string;
        userOf: (userId: string) => UserSummary | undefined;
        translate: (key: ResourceKey) => string;
        onReport: ConsoleReport;
    }

    let { proposals, currentUserId, userOf, translate, onReport }: Props = $props();

    onMount(() => void proposals.refresh());

    const proposedBy = (userId: string) => proposerName(userId, userOf(userId));
</script>

<div class="proposals">
    <div class="intro admin-row">
        <p class="admin-hint">
            These sensitive operations have been proposed by one platform operator and take effect
            only when a <strong>different</strong> operator confirms them. Anyone can reject. Proposals
            expire automatically after 14 days.
        </p>
        <Button
            label="Refresh"
            variant="secondary"
            busy={proposals.loading}
            disabled={proposals.loading}
            onClick={() => void proposals.refresh()} />
    </div>

    {#if !proposals.loading && proposals.pending.length === 0}
        <p class="admin-hint">Nothing is awaiting confirmation</p>
    {/if}

    {#each proposals.pending as proposal (proposal.id)}
        {@const own = isOwnProposal(proposal, currentUserId)}
        {@const busy = proposals.busy.has(proposal.id)}
        <section class="admin-card">
            <p class="summary">#{proposal.id} — {proposal.summary}</p>
            <p class="admin-hint">
                Proposed by {proposedBy(proposal.proposed_by)} at {formatProposalTimestamp(
                    proposal.proposed_at,
                )} · expires {formatProposalTimestamp(proposal.expires_at)}
            </p>
            {#if own}
                <p class="own">
                    You proposed this, so you cannot confirm it — another platform operator must.
                </p>
            {/if}
            <div class="actions">
                <Button
                    label="Confirm"
                    fullWidth
                    {busy}
                    disabled={busy || own}
                    onClick={async () => onReport(await proposals.confirm(proposal.id))} />
                <Button
                    label="Reject"
                    variant="secondary"
                    fullWidth
                    {busy}
                    disabled={busy}
                    onClick={async () => onReport(await proposals.reject(proposal.id))} />
            </div>
        </section>
    {/each}

    {#if proposals.error}
        <p class="admin-error" role="alert">{translate(proposals.error)}</p>
    {/if}
</div>

<style lang="scss">
    .proposals {
        display: flex;
        flex-direction: column;
        gap: var(--space-16);
        max-width: 760px;
    }

    .intro {
        display: flex;
        align-items: flex-start;
        gap: var(--space-16);
    }

    .summary {
        margin: 0;
        font: var(--weight-medium) var(--text-base) / 1.4 var(--font-sans);
        color: var(--ink);
        overflow-wrap: anywhere;
    }

    .own {
        margin: 0;
        font: var(--weight-bold) var(--text-sm) / 1.4 var(--font-sans);
        color: var(--status-warning);
    }

    .actions {
        display: flex;
        gap: var(--space-8);
    }
</style>
