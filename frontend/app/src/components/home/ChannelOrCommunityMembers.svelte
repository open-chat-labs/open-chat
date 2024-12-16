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
    } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Members from "./groupdetails/Members.svelte";
    import MembersHeader from "./groupdetails/MembersHeader.svelte";
    import ScopeToggle from "./communities/ScopeToggle.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    // Whenever we look at the community members we will show the members list for both the community _and_ the channel
    export let closeIcon: "close" | "back";
    export let channel: ChannelSummary;
    export let community: CommunitySummary;
    export let selectedTab: "community" | "channel" = "channel";

    $: canInvite =
        selectedTab === "community"
            ? client.canInviteUsers(community.id)
            : client.canInviteUsers(channel.id);

    function showInviteCommunityUsers(ev: CustomEvent<unknown>) {
        dispatch("showInviteCommunityUsers", ev.detail);
    }

    function onRemoveCommunityMember(ev: CustomEvent<unknown>): void {
        dispatch("removeCommunityMember", ev.detail);
    }

    function onChangeCommunityRole(ev: CustomEvent<unknown>): void {
        dispatch("changeCommunityRole", ev.detail);
    }

    function onBlockCommunityUser(ev: CustomEvent<unknown>): void {
        dispatch("blockCommunityUser", ev.detail);
    }

    function onUnblockCommunityUser(ev: CustomEvent<unknown>): void {
        dispatch("unblockCommunityUser", ev.detail);
    }

    function onBlockGroupUser(ev: CustomEvent<unknown>): void {
        dispatch("blockGroupUser", ev.detail);
    }

    function onUnblockGroupUser(ev: CustomEvent<unknown>): void {
        dispatch("unblockGroupUser", ev.detail);
    }

    function onRemoveGroupMember(ev: CustomEvent<unknown>): void {
        dispatch("removeGroupMember", ev.detail);
    }

    function showInviteGroupUsers(ev: CustomEvent<unknown>): void {
        dispatch("showInviteGroupUsers", ev.detail);
    }

    function onChangeGroupRole(ev: CustomEvent<unknown>): void {
        dispatch("changeGroupRole", ev.detail);
    }

    function showInviteUsers() {
        switch (selectedTab) {
            case "community":
                dispatch("showInviteCommunityUsers");
                break;
            case "channel":
                dispatch("showInviteGroupUsers");
                break;
        }
    }

    function onCancelCommunityInvite(ev: CustomEvent<string>): void {
        dispatch("cancelCommunityInvite", ev.detail);
    }

    function onCancelGroupInvite(ev: CustomEvent<string>): void {
        dispatch("cancelGroupInvite", ev.detail);
    }
</script>

<ScopeToggle bind:selectedTab>
    <MembersHeader
        slot="header"
        level={selectedTab}
        title={i18nKey("Members")}
        {closeIcon}
        {canInvite}
        on:close
        on:showInviteUsers={showInviteUsers} />
    <Members
        slot="community"
        showHeader={false}
        {closeIcon}
        collection={community}
        invited={$currentCommunityInvited}
        members={[...$currentCommunityMembers.values()]}
        blocked={$currentCommunityBlocked}
        lapsed={$currentCommunityLapsed}
        installedBots={$currentCommunityBots}
        on:close
        on:blockUser={onBlockCommunityUser}
        on:unblockUser={onUnblockCommunityUser}
        on:chatWith
        on:showInviteUsers={showInviteCommunityUsers}
        on:removeMember={onRemoveCommunityMember}
        on:changeRole={onChangeCommunityRole}
        on:cancelInvite={onCancelCommunityInvite} />

    <Members
        slot="channel"
        showHeader={false}
        {closeIcon}
        collection={channel}
        invited={$currentChatInvited}
        members={$currentChatMembers}
        blocked={$currentChatBlocked}
        lapsed={$currentChatLapsed}
        installedBots={$currentCommunityBots}
        on:close
        on:blockUser={onBlockGroupUser}
        on:unblockUser={onUnblockGroupUser}
        on:chatWith
        on:showInviteUsers={showInviteGroupUsers}
        on:removeMember={onRemoveGroupMember}
        on:changeRole={onChangeGroupRole}
        on:cancelInvite={onCancelGroupInvite} />
</ScopeToggle>

<style lang="scss">
</style>
