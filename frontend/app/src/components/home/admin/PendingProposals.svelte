<script lang="ts">
    import { currentUserIdStore, type OpenChat, type ResourceKey } from "@client";
    import { getContext, onMount } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Translatable from "../../Translatable.svelte";

    type PendingProposal = {
        id: number;
        summary: string;
        proposed_by: string;
        proposed_at: number;
        expires_at: number;
    };

    const client = getContext<OpenChat>("client");

    let pending: PendingProposal[] = $state([]);
    let loading = $state(true);
    let busy = $state(new Set<number>());
    let error: ResourceKey | undefined = $state(undefined);

    onMount(refresh);

    function refresh(): void {
        loading = true;
        client
            .protectedActions()
            .then((json) => {
                if (json === undefined) {
                    error = i18nKey("Failed to load the pending proposals");
                    return;
                }
                try {
                    pending = JSON.parse(json).pending ?? [];
                } catch {
                    pending = [];
                }
            })
            .finally(() => (loading = false));
    }

    function confirm(id: number): void {
        error = undefined;
        busy.add(id);
        busy = new Set(busy);
        client
            .confirmProtectedAction(BigInt(id))
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast(i18nKey("Proposal confirmed and applied"));
                } else {
                    error = i18nKey(
                        "Failed to confirm the proposal - it may have been superseded, cancelled or expired",
                    );
                    toastStore.showFailureToast(error);
                }
                refresh();
            })
            .finally(() => {
                busy.delete(id);
                busy = new Set(busy);
            });
    }

    function reject(id: number): void {
        error = undefined;
        busy.add(id);
        busy = new Set(busy);
        client
            .cancelProtectedAction(BigInt(id))
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast(i18nKey("Proposal rejected"));
                } else {
                    error = i18nKey("Failed to reject the proposal");
                    toastStore.showFailureToast(error);
                }
                refresh();
            })
            .finally(() => {
                busy.delete(id);
                busy = new Set(busy);
            });
    }

    function formatTimestamp(ms: number): string {
        return new Date(ms).toLocaleString();
    }

    // The canister rejects a confirmation from the proposer; disable it here so the operator
    // is told why rather than finding out through a failed call
    function isOwnProposal(proposal: PendingProposal): boolean {
        return proposal.proposed_by === $currentUserIdStore;
    }
</script>

<div class="pending">
    <div class="intro">
        These changes have been proposed by one platform operator and take effect only when a
        <strong>different</strong> operator confirms them. Anyone can reject. Proposals expire automatically
        after 14 days.
    </div>

    <ButtonGroup align="start">
        <Button tiny secondary onClick={refresh} disabled={loading} {loading}>Refresh</Button>
    </ButtonGroup>

    {#if !loading && pending.length === 0}
        <div class="empty">Nothing is awaiting confirmation.</div>
    {/if}

    {#each pending as proposal (proposal.id)}
        <section class="proposal">
            <div class="summary">#{proposal.id} — {proposal.summary}</div>
            <div class="meta">
                Proposed by {proposal.proposed_by} at {formatTimestamp(proposal.proposed_at)} · expires
                {formatTimestamp(proposal.expires_at)}
            </div>
            {#if isOwnProposal(proposal)}
                <div class="own">
                    You proposed this, so you cannot confirm it — another platform operator must.
                </div>
            {/if}
            <ButtonGroup align="fill">
                <Button
                    tiny
                    disabled={busy.has(proposal.id) || isOwnProposal(proposal)}
                    loading={busy.has(proposal.id)}
                    onClick={() => confirm(proposal.id)}>Confirm</Button
                >
                <Button
                    tiny
                    secondary
                    disabled={busy.has(proposal.id)}
                    loading={busy.has(proposal.id)}
                    onClick={() => reject(proposal.id)}>Reject</Button
                >
            </ButtonGroup>
        </section>
    {/each}

    {#if error}
        <ErrorMessage>
            <Translatable resourceKey={error} />
        </ErrorMessage>
    {/if}
</div>

<style lang="scss">
    .pending {
        display: flex;
        flex-direction: column;
        gap: $sp4;
        padding: 0 $sp4 $sp4 $sp4;
        overflow: auto;
    }

    .intro {
        @include font(book, normal, fs-90);
        color: var(--txt-light);
    }

    .empty {
        @include font(book, normal, fs-90);
        color: var(--txt-light);
        font-style: italic;
    }

    .proposal {
        display: flex;
        flex-direction: column;
        gap: $sp3;
        padding: $sp4;
        border: 1px solid var(--bd);
        border-radius: var(--rd);
    }

    .summary {
        @include font(medium, normal, fs-100);
        word-break: break-word;
    }

    .meta {
        @include font(book, normal, fs-80);
        color: var(--txt-light);
    }

    .own {
        @include font(book, normal, fs-80);
        color: var(--warn);
    }
</style>
