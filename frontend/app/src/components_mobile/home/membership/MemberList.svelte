<script lang="ts">
    import { Container } from "component-lib";
    import {
        currentUserIdStore,
        ROLE_ADMIN,
        ROLE_MEMBER,
        ROLE_MODERATOR,
        ROLE_OWNER,
        type FullMember,
    } from "openchat-client";
    import VirtualList from "../../VirtualList.svelte";
    import Member from "./Member.svelte";
    import type { MemberManagement } from "./membersState.svelte";

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
            canPromoteToOwner={me ? false : membersState.canPromote(member.role, ROLE_OWNER)}
            canPromoteToAdmin={membersState.canPromote(member.role, ROLE_ADMIN)}
            canDemoteToAdmin={membersState.canDemote(member.role, ROLE_ADMIN)}
            canPromoteToModerator={membersState.canPromote(member.role, ROLE_MODERATOR)}
            canDemoteToModerator={membersState.canDemote(member.role, ROLE_MODERATOR)}
            canDemoteToMember={membersState.canDemote(member.role, ROLE_MEMBER)}
            canBlockUser={membersState.canBlockUsers()}
            canRemoveMember={me ? false : membersState.canRemoveMembers()}
            onBlockUser={(userId) => membersState.onBlockUser(userId)}
            onChangeRole={(args) => membersState.onChangeRole(args)}
            onRemoveMember={(userId) => membersState.onRemoveMember(userId)} />
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
