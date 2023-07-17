<script lang="ts">
    import { _ } from "svelte-i18n";
    import CommunityCard from "../explore/CommunityCard.svelte";
    import CommunityDetails from "./CommunityDetails.svelte";
    import { OpenChat, defaultAccessRules } from "openchat-client";
    import CommunityDetailsHeader from "./CommunityDetailsHeader.svelte";
    import { pushRightPanelHistory } from "../../../../stores/rightPanel";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");

    $: selectedCommunity = client.selectedCommunity;
    $: currentCommunityRules = client.currentCommunityRules;
    $: rules = $currentCommunityRules ?? defaultAccessRules();

    $: canDelete =
        $selectedCommunity !== undefined && client.canDeleteCommunity($selectedCommunity.id);
    $: canEdit = $selectedCommunity !== undefined && client.canEditCommunity($selectedCommunity.id);
    $: canInvite = $selectedCommunity !== undefined && client.canInviteUsers($selectedCommunity.id);

    function showChannels() {
        if ($selectedCommunity) {
            pushRightPanelHistory({
                kind: "community_channels",
            });
        }
    }
</script>

{#if $selectedCommunity}
    <CommunityDetailsHeader
        on:editCommunity
        on:showChannels={showChannels}
        community={$selectedCommunity}
        {canEdit}
        level={"community"} />
    <div class="body">
        <CommunityCard
            name={$selectedCommunity.name}
            description={$selectedCommunity.description}
            banner={$selectedCommunity.banner}
            avatar={$selectedCommunity.avatar}
            memberCount={$selectedCommunity.memberCount}
            gate={$selectedCommunity.gate}
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
            community={$selectedCommunity} />
    </div>
{/if}

<style lang="scss">
    .body {
        @include nice-scrollbar();
    }
</style>
