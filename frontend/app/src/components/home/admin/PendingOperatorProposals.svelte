<script lang="ts">
    import { allUsersStore, currentUserIdStore, type OpenChat } from "@client";
    import { Body, BodySmall, Column, Row, Subtitle } from "component-lib";
    import { getContext, onMount } from "svelte";
    import {
        PendingProposals,
        formatProposalTimestamp,
        isOwnProposal as isOwn,
        proposerName,
        type PendingProposal,
        type ProposalOutcome,
    } from "../../../logic/admin/pendingProposals.svelte";
    import { toastStore } from "../../../stores/toast";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Translatable from "@shared_components/Translatable.svelte";

    const client = getContext<OpenChat>("client");
    const proposals = new PendingProposals(client);

    let pending = $derived(proposals.pending);
    let loading = $derived(proposals.loading);
    let busy = $derived(proposals.busy);
    let error = $derived(proposals.error);

    onMount(refresh);

    function refresh(): void {
        void proposals.refresh();
    }

    function report(outcome: ProposalOutcome): void {
        if (outcome.kind === "success") {
            toastStore.showSuccessToast(outcome.message);
        } else {
            toastStore.showFailureToast(outcome.message);
        }
    }

    async function confirm(id: number): Promise<void> {
        report(await proposals.confirm(id));
    }

    async function reject(id: number): Promise<void> {
        report(await proposals.reject(id));
    }

    function proposedBy(userId: string): string {
        return proposerName(userId, $allUsersStore.get(userId));
    }

    function formatTimestamp(ms: number): string {
        return formatProposalTimestamp(ms);
    }

    function isOwnProposal(proposal: PendingProposal): boolean {
        return isOwn(proposal, $currentUserIdStore);
    }
</script>

<Column gap="lg" padding="lg">
    <Row gap="lg">
        <Subtitle>
            These sensitive operations have been proposed by one platform operator and take effect
            only when a
            <strong>different</strong> operator confirms them. Anyone can reject. Proposals expire automatically
            after 14 days.
        </Subtitle>

        <ButtonGroup align="start">
            <Button secondary onClick={refresh} disabled={loading} {loading}>Refresh</Button>
        </ButtonGroup>
    </Row>

    {#if !loading && pending.length === 0}
        <Body colour="textSecondary">Nothing is awaiting confirmation</Body>
    {/if}

    {#each pending as proposal (proposal.id)}
        <Column padding="lg" borderRadius="lg" borderWidth="thick" gap="md">
            <Body>
                #{proposal.id} — {proposal.summary}
            </Body>
            <BodySmall colour="textSecondary">
                Proposed by {proposedBy(proposal.proposed_by)} at {formatTimestamp(
                    proposal.proposed_at,
                )} · expires
                {formatTimestamp(proposal.expires_at)}
            </BodySmall>
            {#if isOwnProposal(proposal)}
                <Body fontWeight="bold" colour="validationWarning">
                    You proposed this, so you cannot confirm it — another platform operator must.
                </Body>
            {/if}
            <ButtonGroup align="fill">
                <Button
                    disabled={busy.has(proposal.id) || isOwnProposal(proposal)}
                    loading={busy.has(proposal.id)}
                    onClick={() => confirm(proposal.id)}>Confirm</Button>
                <Button
                    secondary
                    disabled={busy.has(proposal.id)}
                    loading={busy.has(proposal.id)}
                    onClick={() => reject(proposal.id)}>Reject</Button>
            </ButtonGroup>
        </Column>
    {/each}

    {#if error}
        <ErrorMessage>
            <Translatable resourceKey={error} />
        </ErrorMessage>
    {/if}
</Column>
