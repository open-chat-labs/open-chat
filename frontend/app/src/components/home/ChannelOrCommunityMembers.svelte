<script lang="ts">
    import {
        type ChannelSummary,
        type CommunitySummary,
        type MemberRole,
        OpenChat,
        publish,
        selectedChatBlockedUsersStore,
        selectedChatInvitedUsersStore,
        selectedChatLapsedMembersStore,
        selectedChatMembersStore,
        selectedChatWebhooksStore,
        selectedCommunityBlockedUsersStore,
        selectedCommunityBotsStore,
        selectedCommunityInvitedUsersStore,
        selectedCommunityLapsedMembersStore,
        selectedCommunityMembersStore,
        type UserSummary,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import ScopeToggle from "./communities/ScopeToggle.svelte";
    import Members from "./groupdetails/Members.svelte";
    import MembersHeader from "./groupdetails/MembersHeader.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        // Whenever we look at the community members we will show the members list for both the community _and_ the channel
        closeIcon: "close" | "back";
        channel: ChannelSummary;
        community: CommunitySummary;
        selectedTab?: "community" | "channel";
        onClose: () => void;
        onBlockCommunityUser?: (args: { userId: string }) => void;
        onUnblockCommunityUser: (user: UserSummary) => void;
        onRemoveCommunityMember?: (userId: string) => void;
        onChangeCommunityRole?: (args: {
            userId: string;
            newRole: MemberRole;
            oldRole: MemberRole;
        }) => void;
        onCancelCommunityInvite: (userId: string) => void;
        onShowInviteCommunityUsers: () => void;
        onBlockGroupUser: (args: { userId: string }) => void;
        onUnblockGroupUser: (user: UserSummary) => void;
        onRemoveGroupMember: (userId: string) => void;
        onChangeGroupRole: (args: {
            userId: string;
            newRole: MemberRole;
            oldRole: MemberRole;
        }) => void;
        onCancelGroupInvite: (userId: string) => void;
    }

    let {
        closeIcon,
        channel,
        community,
        selectedTab = $bindable("channel"),
        onClose,
        onBlockCommunityUser,
        onUnblockCommunityUser,
        onRemoveCommunityMember,
        onChangeCommunityRole,
        onCancelCommunityInvite,
        onShowInviteCommunityUsers,
        onBlockGroupUser,
        onUnblockGroupUser,
        onRemoveGroupMember,
        onChangeGroupRole,
        onCancelGroupInvite,
    }: Props = $props();

    let canInvite = $derived(
        selectedTab === "community"
            ? client.canInviteUsers(community.id)
            : client.canInviteUsers(channel.id),
    );

    function showInviteGroupUsers(): void {
        publish("showInviteGroupUsers", true);
    }

    function showInviteUsers() {
        switch (selectedTab) {
            case "community":
                onShowInviteCommunityUsers();
                break;
            case "channel":
                showInviteGroupUsers();
                break;
        }
    }
</script>

<ScopeToggle bind:selectedTab>
    {#snippet header()}
        <MembersHeader
            level={selectedTab}
            title={i18nKey("Members")}
            {closeIcon}
            {canInvite}
            {onClose}
            onShowInviteUsers={showInviteUsers} />
    {/snippet}
    {#snippet communityTab()}
        <Members
            showHeader={false}
            {closeIcon}
            collection={community}
            invited={$selectedCommunityInvitedUsersStore}
            members={[...$selectedCommunityMembersStore.values()]}
            blocked={$selectedCommunityBlockedUsersStore}
            lapsed={$selectedCommunityLapsedMembersStore}
            installedBots={$selectedCommunityBotsStore}
            {onClose}
            onBlockUser={onBlockCommunityUser}
            onUnblockUser={onUnblockCommunityUser}
            onShowInviteUsers={onShowInviteCommunityUsers}
            onRemoveMember={onRemoveCommunityMember}
            onChangeRole={onChangeCommunityRole}
            onCancelInvite={onCancelCommunityInvite} />
    {/snippet}

    {#snippet channelTab()}
        <Members
            showHeader={false}
            {closeIcon}
            collection={channel}
            invited={$selectedChatInvitedUsersStore}
            members={[...$selectedChatMembersStore.values()]}
            blocked={$selectedChatBlockedUsersStore}
            lapsed={$selectedChatLapsedMembersStore}
            installedBots={$selectedCommunityBotsStore}
            webhooks={Array.from($selectedChatWebhooksStore.values())}
            {onClose}
            onBlockUser={onBlockGroupUser}
            onUnblockUser={onUnblockGroupUser}
            onShowInviteUsers={showInviteGroupUsers}
            onRemoveMember={onRemoveGroupMember}
            onChangeRole={onChangeGroupRole}
            onCancelInvite={onCancelGroupInvite} />
    {/snippet}
</ScopeToggle>
