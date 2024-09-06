<script lang="ts">
    import { OpenChat, type ChannelSummary, type CommunitySummary } from "openchat-client";
    import ScopeToggle from "./communities/ScopeToggle.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import CommunityDetailsHeader from "./communities/details/CommunityDetailsHeader.svelte";
    import GroupDetailsHeader from "./groupdetails/GroupDetailsHeader.svelte";
    import GroupDetailsBody from "./groupdetails/GroupDetailsBody.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let closeIcon: "close" | "back";
    export let channel: ChannelSummary;
    export let community: CommunitySummary;
    export let selectedTab: "community" | "channel" = "channel";
    export let memberCount: number;

    $: canEditCommunity = client.canEditCommunity(community.id);
    $: canEditChannel = client.canEditGroupDetails(channel.id);
    $: currentChatRules = client.currentChatRules;

    function editGroup() {
        if (canEditChannel) {
            dispatch("editGroup", {
                chat: channel,
                rules: { ...$currentChatRules, newVersion: false },
            });
        }
    }
</script>

<ScopeToggle bind:selectedTab>
    <div slot="header">
        {#if selectedTab === "community"}
            <CommunityDetailsHeader
                on:editCommunity
                {community}
                canEdit={canEditCommunity}
                level={"community"} />
        {:else if selectedTab === "channel"}
            <GroupDetailsHeader
                level={"channel"}
                canEdit={canEditChannel}
                on:showGroupMembers
                on:close
                on:editGroup={editGroup} />
        {/if}
    </div>
    <div slot="channel">
        <GroupDetailsBody chat={channel} {memberCount} />
    </div>
    <div slot="community">Community details</div>
</ScopeToggle>

<style lang="scss">
</style>
