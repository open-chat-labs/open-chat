<script lang="ts">
    import { _ } from "svelte-i18n";
    import { dummyCommunities } from "../../../../stores/community";
    import CommunityCard from "../explore/CommunityCard.svelte";
    import CommunityDetails from "./CommunityDetails.svelte";
    import { defaultAccessRules, emptyChatMetrics } from "openchat-client";
    import CommunityDetailsHeader from "./CommunityDetailsHeader.svelte";
    import { popRightPanelHistory, pushRightPanelHistory } from "../../../../stores/rightPanel";

    export let communityId: string;

    let rules = { ...defaultAccessRules, enabled: true }; // TODO - shouldn't be the default rules
    let canDelete = true; //TODO - needs to be permissions based
    let canEdit = true; //TODO - needs to be permissions based
    let metrics = emptyChatMetrics(); //TODO where does this come from

    $: community = $dummyCommunities.find((c) => c.id === communityId);

    function showChannels() {
        pushRightPanelHistory({ kind: "community_channels", communityId: communityId });
    }
</script>

{#if community}
    <CommunityDetailsHeader
        on:editCommunity
        on:showChannels={showChannels}
        {community}
        {canEdit}
        level={"community"} />
    <div class="body">
        <CommunityCard joining={false} header {community} selected={false} />
        <CommunityDetails on:deleteCommunity {canDelete} {rules} {metrics} {community} />
    </div>
{/if}

<style lang="scss">
    .body {
        @include nice-scrollbar();
    }
</style>
