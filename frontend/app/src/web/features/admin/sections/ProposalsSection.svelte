<!-- Pending proposals: how dual approval goes (StepIndicator, at its second step), then each
     dual-authorised action awaiting a second operator as a card: its id and summary, who proposed
     it and when, when it expires, and Reject (anyone) and Confirm (not the proposer's own: the
     canister refuses it, so the button is off and says why). Confirm asks first, since it applies
     at once. A card leaves the list once it's confirmed or rejected, so how that went is a toast.
     The proposals carry only their summary, so the cards can't show Current → Proposed. -->
<script lang="ts">
    import { allUsersStore, currentUserIdStore, type ResourceKey } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import ConfirmDialog from "@openchat/ui/src/lib/components/ConfirmDialog.svelte";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import Pill from "@openchat/ui/src/lib/components/Pill.svelte";
    import StepIndicator from "@openchat/ui/src/lib/components/StepIndicator.svelte";
    import {
        formatProposalTimestamp,
        isOwnProposal,
        proposerName,
        type PendingProposal,
    } from "@src/logic/admin/pendingProposals.svelte";
    import { toastStore } from "@src/stores/toast";
    import type { AdminConsole } from "../adminConsole.svelte";

    interface Props {
        admin: AdminConsole;
        translate: (key: ResourceKey) => string;
    }

    let { admin, translate }: Props = $props();

    const proposals = $derived(admin.proposals);
    let confirming = $state<PendingProposal | undefined>(undefined);

    const by = (p: PendingProposal): string =>
        isOwnProposal(p, $currentUserIdStore)
            ? "you"
            : proposerName(p.proposed_by, $allUsersStore.get(p.proposed_by));

    async function confirm(p: PendingProposal): Promise<void> {
        const outcome = await proposals.confirm(p.id);
        confirming = undefined;
        if (outcome.kind === "success") toastStore.showSuccessToast(outcome.message);
        else toastStore.showFailureToast(outcome.message);
    }

    async function reject(p: PendingProposal): Promise<void> {
        const outcome = await proposals.reject(p.id);
        if (outcome.kind === "success") toastStore.showSuccessToast(outcome.message);
        else toastStore.showFailureToast(outcome.message);
    }
</script>

<StepIndicator
    steps={["An operator proposes", "A different operator confirms", "It applies"]}
    current={1} />

{#if proposals.loading && proposals.pending.length === 0}
    {#each [0, 1] as i (i)}
        <div class="card" aria-busy="true" aria-label="Loading">
            <span class="sk" style:width="40%"></span>
            <span class="sk" style:width="65%"></span>
            <span class="sk tall"></span>
        </div>
    {/each}
{:else if proposals.error !== undefined && proposals.pending.length === 0}
    <div class="card">
        <EmptyState
            preset="error"
            title="Couldn’t load the proposals"
            body={translate(proposals.error)}
            actionLabel="Try again"
            actionHandler={() => void proposals.refresh()} />
    </div>
{:else if proposals.pending.length === 0}
    <div class="card state">
        <span class="state-icon"></span>
        <b>Nothing is awaiting confirmation</b>
        <span>
            Proposals from the Danger zone show up here until another operator confirms or rejects
            them, or they expire after 14 days.
        </span>
    </div>
{:else}
    {#each proposals.pending as p (p.id)}
        {@const own = isOwnProposal(p, $currentUserIdStore)}
        {@const busy = proposals.busy.has(p.id)}
        <article class="card" class:busy aria-label={`Proposal ${p.id}: ${p.summary}`}>
            <div class="head">
                <span class="id">#{p.id}</span>
                <span class="summary">{p.summary}</span>
                <Pill
                    label={own ? "Your proposal" : "Awaiting your confirmation"}
                    tone={own ? "neutral" : "warning"} />
            </div>
            <div class="meta">
                Proposed by <b>{by(p)}</b> · {formatProposalTimestamp(p.proposed_at)} · expires
                {formatProposalTimestamp(p.expires_at)}
            </div>
            <div class="foot">
                {#if own}
                    <span class="lock" id={`lock-${p.id}`}>
                        <span class="lock-icon"></span>You proposed this, so you can’t confirm it.
                        Another platform operator must.
                    </span>
                {:else}
                    <span class="spacer"></span>
                {/if}
                <Button
                    label="Reject"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void reject(p)} />
                <Button
                    label="Confirm"
                    {busy}
                    disabled={busy || own}
                    onClick={() => (confirming = p)} />
            </div>
        </article>
    {/each}
    {#if proposals.error !== undefined}
        <p class="error" role="alert">{translate(proposals.error)}</p>
    {/if}
{/if}

{#if confirming !== undefined}
    {@const p = confirming}
    <ConfirmDialog
        title={`Confirm proposal #${p.id}?`}
        body="It applies as soon as you confirm. Make sure it’s what you expect."
        facts={[
            { label: "Change", value: p.summary },
            { label: "Proposed by", value: by(p) },
        ]}
        confirmLabel="Confirm"
        busy={proposals.busy.has(p.id)}
        onConfirm={() => void confirm(p)}
        onClose={() => (confirming = undefined)} />
{/if}

<style lang="scss">
    .card {
        display: flex;
        flex-direction: column;
        gap: var(--space-10);
        padding: var(--space-18);
        border-radius: var(--radius-lg);
        background: var(--surface-1);
        box-shadow: inset 0 0 0 1px var(--line-1);

        &.busy {
            opacity: 0.7;
        }
    }

    .sk {
        display: block;
        height: 12px;
        border-radius: var(--radius-xs);
        background: var(--skeleton-base);
        background-image: var(--skeleton-sheen);
        background-size: 200% 100%;
        animation: oc-shimmer 1.4s linear infinite;

        &.tall {
            width: 90%;
            height: 44px;
            border-radius: var(--radius-md);
        }
    }

    .state {
        align-items: center;
        padding: var(--space-32) var(--space-24);
        text-align: center;
        font: var(--weight-regular) var(--text-sm) / 1.5 var(--font-sans);
        color: var(--ink-3);

        b {
            font: var(--weight-semibold) var(--text-base) / 1.3 var(--font-sans);
            color: var(--ink);
        }
    }

    .state-icon {
        width: 22px;
        height: 22px;
        margin-bottom: var(--space-4);
        background: var(--ink-3);
        mask: var(--icon-check-double) center / contain no-repeat;
    }

    .head {
        display: flex;
        align-items: center;
        gap: var(--space-10);
        min-width: 0;
    }

    .id {
        flex: none;
        font: var(--weight-semibold) var(--text-md) / 1.2 var(--font-mono);
        color: var(--ink-3);
    }

    .summary {
        flex: 1;
        min-width: 0;
        font: var(--weight-semibold) var(--text-base) / 1.35 var(--font-sans);
        color: var(--ink);
        overflow-wrap: anywhere;
    }

    .meta {
        font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
        color: var(--ink-3);

        b {
            font-weight: var(--weight-semibold);
            color: var(--ink-2);
        }
    }

    .foot {
        display: flex;
        align-items: center;
        gap: var(--space-8);
        padding-top: var(--space-10);
        border-top: 1px solid var(--line-1);
    }

    .spacer,
    .lock {
        flex: 1;
        min-width: 0;
    }

    .lock {
        display: flex;
        align-items: center;
        gap: var(--space-6);
        font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
        color: var(--ink-3);
    }

    .lock-icon {
        flex: none;
        width: 14px;
        height: 14px;
        background: currentColor;
        mask: var(--icon-lock) center / contain no-repeat;
    }

    .error {
        margin: 0;
        font: var(--weight-medium) var(--text-sm) / 1.5 var(--font-sans);
        color: var(--status-danger);
    }
</style>
