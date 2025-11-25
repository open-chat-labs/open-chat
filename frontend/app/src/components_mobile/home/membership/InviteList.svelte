<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, Container, FloatingButton } from "component-lib";
    import {
        allUsersStore,
        currentUserIdStore,
        OpenChat,
        publish,
        selectedCommunitySummaryStore,
        type UserSummary,
    } from "openchat-client";
    import { getContext } from "svelte";
    import Account from "svelte-material-icons/AccountGroupOutline.svelte";
    import AccountPlus from "svelte-material-icons/AccountPlusOutline.svelte";
    import ShareIcon from "svelte-material-icons/ShareOutline.svelte";
    import Translatable from "../../Translatable.svelte";
    import NothingToSee from "../NothingToSee.svelte";
    import SelectUsers from "../SelectUsers.svelte";
    import InvitedUser from "./InvitedUser.svelte";
    import InviteUser from "./InviteUser.svelte";
    import type { MemberManagement } from "./membersState.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        membersState: MemberManagement;
    }
    let { membersState }: Props = $props();

    let invited = $derived<UserSummary[]>(
        membersState.getUsersFromSet($allUsersStore, membersState.invited),
    );

    function dmFilter(user: UserSummary) {
        return !membersState.invited.has(user.userId);
    }

    function searchUsers(term: string): Promise<[UserSummary[], UserSummary[]]> {
        const canInvite =
            $selectedCommunitySummaryStore !== undefined &&
            client.canInviteUsers($selectedCommunitySummaryStore.id);
        return client.searchUsersForInvite(term, 20, membersState.level, false, canInvite);
    }
</script>

{#snippet userView(user: UserSummary, invited: boolean, onSelect?: (user: UserSummary) => void)}
    {@const me = user.userId === $currentUserIdStore}
    <Container padding={["md", "zero"]}>
        {#if invited}
            <InvitedUser
                {me}
                {user}
                onCancelInvite={invited && membersState.canUninvite()
                    ? (userId) => membersState.cancelInvites([userId])
                    : undefined} />
        {:else}
            <InviteUser
                {me}
                {user}
                onInvite={membersState.canInvite() && onSelect
                    ? () => onSelect(user)
                    : undefined} />
        {/if}
    </Container>
{/snippet}

{#snippet membersIcon(color: string, size: string)}
    <Account {color} {size} />
{/snippet}

<Container padding={["zero", "md"]}>
    <SelectUsers
        onDeleteUser={(user) => membersState.deleteInvited(user)}
        onSelectUser={(user) => membersState.addInvited(user)}
        userLookup={searchUsers}
        selectedUsers={membersState.usersToAddOrInvite}
        {dmFilter}
        mode={"add"}>
        {#snippet matchingUser(user, onSelect)}
            {@render userView(user, false, onSelect)}
        {/snippet}
    </SelectUsers>
</Container>

<Container height={{ kind: "fill" }} padding={["zero", "md"]} gap={"xl"} direction={"vertical"}>
    {#if invited.length === 0}
        <NothingToSee
            reset={{
                onClick: () => publish("closeModalPage"),
                icon: membersIcon,
                text: "View all members",
            }}
            padding={["huge", "xxl"]}
            title={"No invited users"}
            subtitle={"There are no users waiting to accept your invitation. When you invite users, they will appear hear until they accept."}>
            {#snippet icon(color, size)}
                <AccountPlus {color} {size} />
            {/snippet}
        </NothingToSee>
    {:else if invited.length > 0}
        <Container direction={"vertical"} gap={"md"}>
            <Body fontWeight={"bold"}>
                <Translatable
                    resourceKey={i18nKey(`Previously invited users (${invited.length})`)} />
            </Body>
            <Body colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey(
                        "Users which have been invited to this group, but have not accepted the invite yet.",
                    )} />
            </Body>
        </Container>
        <Container direction={"vertical"}>
            {#each invited as user}
                {#if user !== undefined}
                    {@render userView(user, true, undefined)}
                {/if}
            {/each}
        </Container>
    {/if}
</Container>

<FloatingButton
    loading={membersState.inviting}
    disabled={membersState.usersToAddOrInvite.length === 0}
    onClick={() => membersState.inviteUsers()}
    pos={{ bottom: "lg", right: "lg" }}>
    {#snippet icon(color)}
        <ShareIcon {color} />
    {/snippet}
</FloatingButton>
