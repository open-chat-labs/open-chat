<script lang="ts">
    import { OpenChat, type ChannelSummary, type CommunitySummary } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import Members from "./groupdetails/Members.svelte";
    import MembersHeader from "./groupdetails/MembersHeader.svelte";

    const client = getContext<OpenChat>("client");

    // Whenever we look at the community members we will show the members list for both the community _and_ the channel
    export let closeIcon: "close" | "back";
    export let channel: ChannelSummary;
    export let community: CommunitySummary;

    let selectedTab: "community" | "channel" = "community";

    $: currentChatMembers = client.currentChatMembers;
    $: currentChatInvited = client.currentChatInvitedUsers;
    $: currentChatBlocked = client.currentChatBlockedUsers;
    $: currentCommunityMembers = client.currentCommunityMembers;
    $: currentCommunityInvited = client.currentCommunityInvitedUsers;
    $: currentCommunityBlocked = client.currentCommunityBlockedUsers;
    $: canInvite =
        selectedTab === "community"
            ? client.canInviteUsers(community.id)
            : client.canInviteUsers(channel.id);

    function selectTab(tab: "community" | "channel") {
        selectedTab = tab;
    }

    function showInviteCommunityUsers(_: CustomEvent<any>): void {
        throw new Error("Function not implemented.");
    }

    function onRemoveCommunityMember(_: CustomEvent<any>): void {
        throw new Error("Function not implemented.");
    }

    function onChangeCommunityRole(_: CustomEvent<any>): void {
        throw new Error("Function not implemented.");
    }

    function onBlockCommunityUser(_: CustomEvent<any>): void {
        throw new Error("Function not implemented.");
    }

    function onUnblockCommunityUser(_: CustomEvent<any>): void {
        throw new Error("Function not implemented.");
    }

    function onBlockGroupUser(_: CustomEvent<any>): void {
        throw new Error("Function not implemented.");
    }

    function onUnblockGroupUser(_: CustomEvent<any>): void {
        throw new Error("Function not implemented.");
    }

    function onRemoveGroupMember(_: CustomEvent<any>): void {
        throw new Error("Function not implemented.");
    }

    function showInviteGroupUsers(_: CustomEvent<any>): void {
        throw new Error("Function not implemented.");
    }

    function onChangeGroupRole(_: CustomEvent<any>): void {
        throw new Error("Function not implemented.");
    }

    function showInviteUsers() {
        throw new Error("Function not implemented.");
    }
</script>

<MembersHeader
    level={selectedTab}
    title={i18nKey("Members")}
    {closeIcon}
    {canInvite}
    on:close={close}
    on:showInviteUsers={showInviteUsers} />

<div class="button-tabs">
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
        class:selected={selectedTab === "community"}
        on:click={() => selectTab("community")}
        class="button-tab">
        <Translatable resourceKey={i18nKey("membersHeader", undefined, "community")} />
    </div>

    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
        class:selected={selectedTab === "channel"}
        on:click={() => selectTab("channel")}
        class="button-tab">
        <Translatable resourceKey={i18nKey("membersHeader", undefined, "channel")} />
    </div>
</div>

{#if selectedTab === "community"}
    <Members
        showHeader={false}
        {closeIcon}
        collection={community}
        invited={$currentCommunityInvited}
        members={[...$currentCommunityMembers.values()]}
        blocked={$currentCommunityBlocked}
        on:close
        on:blockUser={onBlockCommunityUser}
        on:unblockUser={onUnblockCommunityUser}
        on:chatWith
        on:showInviteUsers={showInviteCommunityUsers}
        on:removeMember={onRemoveCommunityMember}
        on:changeRole={onChangeCommunityRole} />
{:else if selectedTab === "channel"}
    <Members
        showHeader={false}
        {closeIcon}
        collection={channel}
        invited={$currentChatInvited}
        members={$currentChatMembers}
        blocked={$currentChatBlocked}
        on:close
        on:blockUser={onBlockGroupUser}
        on:unblockUser={onUnblockGroupUser}
        on:chatWith
        on:showInviteUsers={showInviteGroupUsers}
        on:removeMember={onRemoveGroupMember}
        on:changeRole={onChangeGroupRole} />
{/if}

<style lang="scss">
    .button-tabs {
        margin-bottom: $sp4;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: var(--bw) solid var(--bd);
        border-bottom: var(--bw) solid var(--bd);

        .button-tab {
            display: flex;
            justify-content: center;
            align-items: center;
            flex: 1;
            height: toRem(50);
            cursor: pointer;
            transition:
                background ease-in-out 200ms,
                color ease-in-out 200ms;

            &.selected {
                background-color: var(--button-bg);
                @media (hover: hover) {
                    &:hover {
                        background: var(--button-hv);
                        color: var(--button-hv-txt);
                    }
                }
            }
        }
    }
</style>
