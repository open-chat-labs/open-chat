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
    } from "openchat-client";
    import { getContext } from "svelte";
    import CommunityDetails from "./communities/details/CommunityDetails.svelte";
    import CommunityDetailsHeader from "./communities/details/CommunityDetailsHeader.svelte";
    import CommunityCard from "./communities/explore/CommunityCard.svelte";
    import ScopeToggle from "./communities/ScopeToggle.svelte";
    import { updateGroupState } from "./createOrUpdateGroup/group.svelte";
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
            updateGroupState.initialise({
                id: channel.id,
                kind: "candidate_group_chat",
                name: channel.name,
                description: channel.description,
                historyVisible: channel.historyVisible,
                public: channel.public,
                frozen: channel.frozen,
                members: [],
                permissions: { ...channel.permissions },
                rules: {
                    ...($selectedChatRulesStore ?? defaultChatRules("channel")),
                    newVersion: false,
                },
                avatar: {
                    blobReference: channel.blobReference,
                    blobUrl: channel.blobUrl,
                    blobData: channel.blobData,
                },
                gateConfig: { ...channel.gateConfig },
                level: channel.level,
                membership: channel.membership,
                eventsTTL: channel.eventsTTL,
                messagesVisibleToNonMembers: channel.messagesVisibleToNonMembers,
                externalUrl: channel.kind === "channel" ? channel.externalUrl : undefined,
                verified: false,
            });
            publish("updateGroup");
        }
    }
</script>

<ScopeToggle bind:selectedTab>
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
