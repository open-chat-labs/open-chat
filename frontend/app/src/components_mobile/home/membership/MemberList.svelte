<script lang="ts">
    import { Container } from "component-lib";
    import {
        currentUserIdStore,
        type FullMember,
    } from "@client";
    import VirtualList from "@openchat/ui/src/lib/virtual/VirtualList.svelte";
    import { _ } from "svelte-i18n";
    import Member from "./Member.svelte";
    import type { MemberManagement } from "@src/logic/members/memberManagement.svelte";
    import { toastStore } from "@src/stores/toast";

    interface Props {
        members: FullMember[];
        membersState: MemberManagement;
        searchTerm?: string;
    }
    let { members, membersState, searchTerm }: Props = $props();
    let virtualise = $derived(members.length > 50);
</script>

{#snippet memberView(member: FullMember)}
    {@const me = member.userId === $currentUserIdStore}
    <Container padding={["md", "zero"]}>
        <Member
            {searchTerm}
            {me}
            {member}
            {...membersState.actionsFor(member.role, me)}
            onBlockUser={async (userId) => toastStore.showOutcome(await membersState.blockUser(userId))}
            onChangeRole={async (args) =>
                toastStore.showOutcome(await membersState.changeRole(args, $_))}
            onRemoveMember={async (userId) =>
                toastStore.showOutcome(await membersState.removeMember(userId))} />
    </Container>
{/snippet}

{#if virtualise}
    <VirtualList keyFn={(user) => user.userId} items={members}>
        {#snippet children(member)}
            {#if member !== undefined}
                {@render memberView(member)}
            {/if}
        {/snippet}
    </VirtualList>
{:else}
    <Container direction={"vertical"}>
        {#each members as member}
            {#if member !== undefined}
                {@render memberView(member)}
            {/if}
        {/each}
    </Container>
{/if}
