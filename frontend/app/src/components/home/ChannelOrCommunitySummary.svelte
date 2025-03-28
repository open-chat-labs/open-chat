<script lang="ts">
    import {
        defaultChatRules,
        OpenChat,
        type ChannelSummary,
        type CommunitySummary,
        currentChatRules,
        currentCommunityRules,
        currentCommunityReferrals,
    } from "openchat-client";
    import ScopeToggle from "./communities/ScopeToggle.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import CommunityDetailsHeader from "./communities/details/CommunityDetailsHeader.svelte";
    import GroupDetailsHeader from "./groupdetails/GroupDetailsHeader.svelte";
    import GroupDetailsBody from "./groupdetails/GroupDetailsBody.svelte";
    import CommunityCard from "./communities/explore/CommunityCard.svelte";
    import CommunityDetails from "./communities/details/CommunityDetails.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let channel: ChannelSummary;
    export let community: CommunitySummary;
    export let selectedTab: "community" | "channel" = "channel";
    export let memberCount: number;

    $: communityFrozen = client.isCommunityFrozen(community.id);
    $: channelFrozen = client.isChatFrozen(channel.id);
    $: canEditCommunity = !communityFrozen && client.canEditCommunity(community.id);
    $: canEditChannel =
        !channelFrozen && !communityFrozen && client.canEditGroupDetails(channel.id);
    $: rules = $currentCommunityRules ?? defaultChatRules("community");
    $: canDeleteCommunity = client.canDeleteCommunity(community.id);
    $: canInviteToCommunity = !communityFrozen && client.canInviteUsers(community.id);

    function editGroup() {
        if (canEditChannel) {
            dispatch("editGroup", {
                chat: channel,
                rules: { ...$currentChatRules, newVersion: false },
            });
        }
    }
</script>

<ScopeToggle flush bind:selectedTab>
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
                on:close
                on:editGroup={editGroup} />
        {/if}
    </div>
    <div slot="channel">
        <GroupDetailsBody chat={channel} {memberCount} />
    </div>
    <div slot="community">
        <CommunityCard
            id={community.id.communityId}
            name={community.name}
            description={community.description}
            banner={community.banner}
            avatar={community.avatar}
            memberCount={community.memberCount}
            gateConfig={community.gateConfig}
            language={community.primaryLanguage}
            flags={0}
            channelCount={0}
            verified={community.verified}
            header />
        <CommunityDetails
            canDelete={canDeleteCommunity}
            canInvite={canInviteToCommunity}
            {rules}
            metrics={community.metrics}
            {community}
            referrals={$currentCommunityReferrals} />
    </div>
</ScopeToggle>
