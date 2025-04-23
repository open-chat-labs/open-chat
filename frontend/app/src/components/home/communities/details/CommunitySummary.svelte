<script lang="ts">
    import { type OpenChat, app, defaultChatRules } from "openchat-client";
    import { getContext } from "svelte";
    import CommunityCard from "../explore/CommunityCard.svelte";
    import CommunityDetails from "./CommunityDetails.svelte";
    import CommunityDetailsHeader from "./CommunityDetailsHeader.svelte";

    const client = getContext<OpenChat>("client");

    let frozen = $derived(client.isCommunityFrozen(app.selectedCommunitySummary?.id));
    let rules = $derived(app.selectedCommunity.rules ?? defaultChatRules("community"));
    let canDelete = $derived(
        app.selectedCommunitySummary !== undefined &&
            !frozen &&
            client.canDeleteCommunity(app.selectedCommunitySummary.id),
    );
    let canEdit = $derived(
        app.selectedCommunitySummary !== undefined &&
            !frozen &&
            client.canEditCommunity(app.selectedCommunitySummary.id),
    );
    let canInvite = $derived(
        app.selectedCommunitySummary !== undefined &&
            !frozen &&
            client.canInviteUsers(app.selectedCommunitySummary.id),
    );
</script>

{#if app.selectedCommunitySummary}
    <CommunityDetailsHeader
        community={app.selectedCommunitySummary}
        {canEdit}
        level={"community"} />
    <div class="body">
        <CommunityCard
            id={app.selectedCommunitySummary.id.communityId}
            name={app.selectedCommunitySummary.name}
            description={app.selectedCommunitySummary.description}
            banner={app.selectedCommunitySummary.banner}
            avatar={app.selectedCommunitySummary.avatar}
            memberCount={app.selectedCommunitySummary.memberCount}
            gateConfig={app.selectedCommunitySummary.gateConfig}
            language={app.selectedCommunitySummary.primaryLanguage}
            flags={0}
            channelCount={0}
            header
            verified={app.selectedCommunitySummary.verified} />
        <CommunityDetails
            {canDelete}
            {canInvite}
            {rules}
            metrics={app.selectedCommunitySummary.metrics}
            community={app.selectedCommunitySummary}
            referrals={app.selectedCommunity.referrals} />
    </div>
{/if}

<style lang="scss">
    .body {
        @include nice-scrollbar();
    }
</style>
