<script lang="ts">
    import {
        OpenChat,
        type ChannelSummary,
        type CommunitySummary,
        currentChatMembers,
        currentChatInvitedUsers as currentChatInvited,
        currentChatBlockedUsers as currentChatBlocked,
        currentChatLapsedMembers as currentChatLapsed,
        currentCommunityMembers,
        currentCommunityInvitedUsers as currentCommunityInvited,
        currentCommunityBlockedUsers as currentCommunityBlocked,
        currentCommunityLapsedMembers as currentCommunityLapsed,
        currentCommunityBots,
        currentCommunityApiKeys,
        currentChatApiKeys,
        type UserSummary,
        type MemberRole,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Members from "./groupdetails/Members.svelte";
    import MembersHeader from "./groupdetails/MembersHeader.svelte";
    import ScopeToggle from "./communities/ScopeToggle.svelte";
    import { publish } from "@src/utils/pubsub";

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
            invited={$currentCommunityInvited}
            members={[...$currentCommunityMembers.values()]}
            blocked={$currentCommunityBlocked}
            lapsed={$currentCommunityLapsed}
            installedBots={$currentCommunityBots}
            apiKeys={$currentCommunityApiKeys}
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
            invited={$currentChatInvited}
            members={$currentChatMembers}
            blocked={$currentChatBlocked}
            lapsed={$currentChatLapsed}
            installedBots={$currentCommunityBots}
            apiKeys={$currentChatApiKeys}
            {onClose}
            onBlockUser={onBlockGroupUser}
            onUnblockUser={onUnblockGroupUser}
            onShowInviteUsers={showInviteGroupUsers}
            onRemoveMember={onRemoveGroupMember}
            onChangeRole={onChangeGroupRole}
            onCancelInvite={onCancelGroupInvite} />
    {/snippet}
</ScopeToggle>
