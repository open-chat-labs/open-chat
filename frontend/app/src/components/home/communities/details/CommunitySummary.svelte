<script lang="ts">
    import CommunityCard from "../explore/CommunityCard.svelte";
    import CommunityDetails from "./CommunityDetails.svelte";
    import { type OpenChat, defaultChatRules } from "openchat-client";
    import CommunityDetailsHeader from "./CommunityDetailsHeader.svelte";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");

    $: selectedCommunity = client.selectedCommunity;
    $: currentCommunityRules = client.currentCommunityRules;
    $: currentCommunityReferrals = client.currentCommunityReferrals;
    $: rules = $currentCommunityRules ?? defaultChatRules("community");

    $: canDelete =
        $selectedCommunity !== undefined && client.canDeleteCommunity($selectedCommunity.id);
    $: canEdit = $selectedCommunity !== undefined && client.canEditCommunity($selectedCommunity.id);
    $: canInvite = $selectedCommunity !== undefined && client.canInviteUsers($selectedCommunity.id);
</script>

{#if $selectedCommunity}
    <CommunityDetailsHeader
        on:editCommunity
        community={$selectedCommunity}
        {canEdit}
        level={"community"} />
    <div class="body">
        <CommunityCard
            id={$selectedCommunity.id.communityId}
            name={$selectedCommunity.name}
            description={$selectedCommunity.description}
            banner={$selectedCommunity.banner}
            avatar={$selectedCommunity.avatar}
            memberCount={$selectedCommunity.memberCount}
            gate={$selectedCommunity.gateConfig.gate}
            language={$selectedCommunity.primaryLanguage}
            flags={0}
            channelCount={0}
            header />
        <CommunityDetails
            on:deleteCommunity
            {canDelete}
            {canInvite}
            {rules}
            metrics={$selectedCommunity.metrics}
            community={$selectedCommunity}
            referrals={$currentCommunityReferrals} />
    </div>
{/if}

<style lang="scss">
    .body {
        @include nice-scrollbar();
    }
</style>
