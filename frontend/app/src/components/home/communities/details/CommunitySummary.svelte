<script lang="ts">
    import { communityDetailsPermissions } from "@src/logic/groupOrCommunity/detailsPermissions";
    import {
        type OpenChat,
        anonUserStore,
        defaultChatRules,
        selectedCommunityReferralsStore,
        selectedCommunityRulesStore,
        selectedCommunitySummaryStore,
    } from "@client";
    import { getContext } from "svelte";
    import CommunityCard from "../explore/CommunityCard.svelte";
    import CommunityDetails from "./CommunityDetails.svelte";
    import CommunityDetailsHeader from "./CommunityDetailsHeader.svelte";

    const client = getContext<OpenChat>("client");

    let rules = $derived($selectedCommunityRulesStore ?? defaultChatRules("community"));
    let permissions = $derived(
        $selectedCommunitySummaryStore === undefined
            ? undefined
            : communityDetailsPermissions(client, $selectedCommunitySummaryStore, $anonUserStore),
    );
    let canDelete = $derived(permissions?.canDelete ?? false);
    let canEdit = $derived(permissions?.canEdit ?? false);
    let canInvite = $derived(permissions?.canInvite ?? false);
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
