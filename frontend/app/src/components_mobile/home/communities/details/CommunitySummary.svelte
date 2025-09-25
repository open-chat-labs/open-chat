<script lang="ts">
    import {
        type OpenChat,
        defaultChatRules,
        selectedCommunityReferralsStore,
        selectedCommunityRulesStore,
        selectedCommunitySummaryStore,
    } from "openchat-client";
    import { getContext } from "svelte";
    import CommunityCard from "../explore/CommunityCard.svelte";
    import CommunityDetails from "./CommunityDetails.svelte";
    import CommunityDetailsHeader from "./CommunityDetailsHeader.svelte";

    const client = getContext<OpenChat>("client");

    let frozen = $derived(client.isCommunityFrozen($selectedCommunitySummaryStore?.id));
    let rules = $derived($selectedCommunityRulesStore ?? defaultChatRules("community"));
    let canDelete = $derived(
        $selectedCommunitySummaryStore !== undefined &&
            !frozen &&
            client.canDeleteCommunity($selectedCommunitySummaryStore.id),
    );
    let canEdit = $derived(
        $selectedCommunitySummaryStore !== undefined &&
            !frozen &&
            client.canEditCommunity($selectedCommunitySummaryStore.id),
    );
    let canInvite = $derived(
        $selectedCommunitySummaryStore !== undefined &&
            !frozen &&
            client.canInviteUsers($selectedCommunitySummaryStore.id),
    );
</script>

{#if $selectedCommunitySummaryStore}
    <CommunityDetailsHeader
        community={$selectedCommunitySummaryStore}
        {canEdit}
        level={"community"} />
    <div class="body">
        <CommunityCard
            id={$selectedCommunitySummaryStore.id.communityId}
            name={$selectedCommunitySummaryStore.name}
            description={$selectedCommunitySummaryStore.description}
            banner={$selectedCommunitySummaryStore.banner}
            avatar={$selectedCommunitySummaryStore.avatar}
            memberCount={$selectedCommunitySummaryStore.memberCount}
            gateConfig={$selectedCommunitySummaryStore.gateConfig}
            language={$selectedCommunitySummaryStore.primaryLanguage}
            flags={0}
            channelCount={0}
            header
            verified={$selectedCommunitySummaryStore.verified} />
        <CommunityDetails
            {canDelete}
            {canInvite}
            {rules}
            metrics={$selectedCommunitySummaryStore.metrics}
            community={$selectedCommunitySummaryStore}
            referrals={$selectedCommunityReferralsStore} />
    </div>
{/if}

<style lang="scss">
    .body {
        @include nice-scrollbar();
    }
</style>
