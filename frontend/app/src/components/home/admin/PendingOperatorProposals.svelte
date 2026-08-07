<script lang="ts">
    import { allUsersStore, currentUserIdStore, type OpenChat, type ResourceKey } from "@client";
    import { Body, BodySmall, Column, Row, Subtitle } from "component-lib";
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
                hydrateProposers();
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

    // Operators are not necessarily in the local user cache (you may share no chats with
    // them), so pull in any proposer we do not already know. getUser populates the store,
    // which the template reads reactively
    function hydrateProposers(): void {
        const missing = new Set(
            pending.map((p) => p.proposed_by).filter((id) => !$allUsersStore.has(id)),
        );
        for (const userId of missing) {
            client.getUser(userId);
        }
    }

    function proposedBy(userId: string): string {
        const user = $allUsersStore.get(userId);
        return user === undefined ? userId : `@${user.username}`;
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
                <Body fontWeight="bold" colour="warning">
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
