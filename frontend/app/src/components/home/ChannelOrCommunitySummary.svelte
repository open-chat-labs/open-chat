<script lang="ts">
    import {
        chatDetailsPermissions,
        communityDetailsPermissions,
    } from "@src/logic/groupOrCommunity/detailsPermissions";
    import {
        anonUserStore,
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
    import CommunityDetails from "./communities/details/CommunityDetails.svelte";
    import CommunityDetailsHeader from "./communities/details/CommunityDetailsHeader.svelte";
    import CommunityCard from "./communities/explore/CommunityCard.svelte";
    import ScopeToggle from "./communities/ScopeToggle.svelte";
    import GroupDetailsBody from "./groupdetails/GroupDetailsBody.svelte";
    import GroupDetailsHeader from "./groupdetails/GroupDetailsHeader.svelte";

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

    let communityPermissions = $derived(
        communityDetailsPermissions(client, community, $anonUserStore),
    );
    let canEditCommunity = $derived(communityPermissions.canEdit);
    let canEditChannel = $derived(
        chatDetailsPermissions(client, channel, community, $anonUserStore).canEdit,
    );
    let rules = $derived($selectedCommunityRulesStore ?? defaultChatRules("community"));
    let canDeleteCommunity = $derived(communityPermissions.canDelete);
    let canInviteToCommunity = $derived(communityPermissions.canInvite);

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
