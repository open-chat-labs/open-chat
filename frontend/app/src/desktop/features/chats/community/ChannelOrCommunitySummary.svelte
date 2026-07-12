<script lang="ts">
    import {
        defaultChatRules,
        OpenChat,
        publish,
        selectedChatRulesStore,
        selectedCommunityReferralsStore,
        selectedCommunityRulesStore,
        type ChannelSummary,
        type CommunitySummary,
    } from "@client";
    import { getContext } from "svelte";
    import CommunityDetails from "@src/desktop/features/chats/community/details/CommunityDetails.svelte";
    import CommunityDetailsHeader from "@src/desktop/features/chats/community/details/CommunityDetailsHeader.svelte";
    import CommunityCard from "@src/desktop/features/chats/community/explore/CommunityCard.svelte";
    import ScopeToggle from "./ScopeToggle.svelte";
    import GroupDetailsBody from "@src/desktop/features/chats/group/GroupDetailsBody.svelte";
    import GroupDetailsHeader from "@src/desktop/features/chats/group/GroupDetailsHeader.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        channel: ChannelSummary;
        community: CommunitySummary;
        selectedTab?: "community" | "channel";
        memberCount: number;
        onClose: () => void;
    }

    let {
        channel,
        community,
        selectedTab = $bindable("channel"),
        memberCount,
        onClose,
    }: Props = $props();

    let communityFrozen = $derived(client.isCommunityFrozen(community.id));
    let channelFrozen = $derived(client.isChatFrozen(channel.id));
    let canEditCommunity = $derived(!communityFrozen && client.canEditCommunity(community.id));
    let canEditChannel = $derived(
        !channelFrozen && !communityFrozen && client.canEditGroupDetails(channel.id),
    );
    let rules = $derived($selectedCommunityRulesStore ?? defaultChatRules("community"));
    let canDeleteCommunity = $derived(client.canDeleteCommunity(community.id));
    let canInviteToCommunity = $derived(!communityFrozen && client.canInviteUsers(community.id));

    function editGroup() {
        if (canEditChannel) {
            publish("editGroup", {
                chat: channel,
                rules: {
                    ...($selectedChatRulesStore ?? defaultChatRules("channel")),
                    newVersion: false,
                },
            });
        }
    }
</script>

<ScopeToggle flush bind:selectedTab>
    {#snippet header()}
        {#if selectedTab === "community"}
            <CommunityDetailsHeader {community} canEdit={canEditCommunity} level={"community"} />
        {:else if selectedTab === "channel"}
            <GroupDetailsHeader
                level={"channel"}
                canEdit={canEditChannel}
                {onClose}
                onEditGroup={editGroup} />
        {/if}
    {/snippet}
    {#snippet channelTab()}
        <GroupDetailsBody chat={channel} {memberCount} />
    {/snippet}
    {#snippet communityTab()}
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
            referrals={$selectedCommunityReferralsStore} />
    {/snippet}
</ScopeToggle>
