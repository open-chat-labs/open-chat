<script lang="ts">
    import { Container, FloatingButton } from "component-lib";
    import {
        currentUserIdStore,
        OpenChat,
        publish,
        selectedChatMembersStore,
        selectedCommunityMembersStore,
        type UserSummary,
    } from "openchat-client";
    import { getContext } from "svelte";
    import ShareIcon from "svelte-material-icons/ShareOutline.svelte";
    import SelectUsers from "../SelectUsers.svelte";
    import AddUser from "./AddUser.svelte";
    import type { MemberManagement } from "./membersState.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        membersState: MemberManagement;
    }
    let { membersState }: Props = $props();
    let communityMembers = $derived($selectedCommunityMembersStore);
    let channelMembers = $derived($selectedChatMembersStore);

    function searchUsers(term: string): Promise<[UserSummary[], UserSummary[]]> {
        return client.searchCommunityMembersToAdd(term, 20);
    }

    function addUsers() {
        membersState.addUsers().then((success) => {
            if (success) {
                publish("closeModalPage");
            }
        });
    }
</script>

{#snippet userView(user: UserSummary, onSelect?: (user: UserSummary) => void)}
    {@const me = user.userId === $currentUserIdStore}
    <Container padding={["md", "zero"]}>
        <AddUser
            {me}
            {user}
            onAdd={membersState.canAdd() && onSelect ? () => onSelect(user) : undefined} />
    </Container>
{/snippet}

<Container padding={["zero", "md"]}>
    <SelectUsers
        placeholderKey={"Search community members"}
        onDeleteUser={(user) => membersState.deleteInvited(user)}
        onSelectUser={(user) => membersState.addInvited(user)}
        userLookup={searchUsers}
        selectedUsers={membersState.usersToAddOrInvite}
        dmFilter={(user) => communityMembers.has(user.userId) && !channelMembers.has(user.userId)}
        mode={"add"}>
        {#snippet matchingUser(user, onSelect)}
            {@render userView(user, onSelect)}
        {/snippet}
    </SelectUsers>
</Container>

<FloatingButton
    loading={membersState.inviting}
    disabled={membersState.usersToAddOrInvite.length === 0}
    onClick={addUsers}
    pos={{ bottom: "lg", right: "lg" }}>
    {#snippet icon(color)}
        <ShareIcon {color} />
    {/snippet}
</FloatingButton>
