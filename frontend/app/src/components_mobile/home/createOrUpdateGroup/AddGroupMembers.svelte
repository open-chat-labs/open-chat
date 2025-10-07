<script lang="ts">
    import { Container, FloatingButton } from "component-lib";
    import {
        OpenChat,
        ROLE_MEMBER,
        type CandidateGroupChat,
        type CandidateMember,
        type UserOrUserGroup,
        type UserSummary,
    } from "openchat-client";
    import { getContext } from "svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import SelectUsers from "./SelectUsers.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        candidateGroup: CandidateGroupChat;
        candidateMembers: CandidateMember[];
        onDeleteUser: (user: UserOrUserGroup) => void;
        onNext: () => void;
    }

    let { onDeleteUser, onNext, candidateGroup, candidateMembers = $bindable() }: Props = $props();
    let selectedUsers = $derived(candidateMembers.map((m) => m.user));

    function searchUsers(term: string): Promise<[UserSummary[], UserSummary[]]> {
        return client.searchUsersForInvite(term, 20, candidateGroup.level, true, true);
    }

    function addMember(user: UserSummary): void {
        const u = candidateMembers.find((m) => m.user.userId === user.userId);
        if (u === undefined) {
            candidateMembers.push({ role: ROLE_MEMBER, user });
        }
    }
</script>

<Container
    supplementalClass={"add_group_members"}
    height={{ kind: "fill" }}
    gap={"xl"}
    direction={"vertical"}
    padding={["xxl", "lg", "lg", "lg"]}>
    <SelectUsers
        {onDeleteUser}
        onSelectUser={addMember}
        userLookup={searchUsers}
        {selectedUsers}
        mode={"add"}></SelectUsers>
</Container>

<div class="add_group_members_next">
    <FloatingButton onClick={onNext}>
        {#snippet icon(color)}
            <Check {color} />
        {/snippet}
    </FloatingButton>
</div>

<style lang="scss">
    .add_group_members_next {
        position: absolute;
        bottom: var(--sp-md);
        right: var(--sp-md);
    }
</style>
