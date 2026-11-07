<!-- You → Communities (native design notes §3.11, "per-community names"): each of the user's
     communities with the name they go by there, their display name where they haven't set one; a
     row opens a sheet to set it, or go back to their display name (logic/profile/communityName,
     as the web's profile and the old screens). The design's "Use my display name everywhere"
     switch isn't a setting the app has (GAPS.md). Without a community, where to find one. -->
<script lang="ts">
    import {
        currentUserProfileStore,
        sortedCommunitiesStore,
        type CommunitySummary,
    } from "@client";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import SettingsLink from "@openchat/ui/src/native/SettingsLink.svelte";
    import { navigate } from "@src/utils/navigation";
    import { untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { useOverlay } from "../../../shell/overlays.svelte";
    import type { ScreenContext } from "../../app/screens";
    import CommunityNameSheet from "./CommunityNameSheet.svelte";

    let { context }: { context: ScreenContext } = $props();
    const overlays = untrack(() => context.overlays);

    const displayName = $derived(
        $currentUserProfileStore.displayName ?? $currentUserProfileStore.username,
    );

    // the community whose name is being set; kept while its sheet plays its way out. The sheet is
    // mounted again each time it opens (`sheetKey`), so what was typed and not saved goes with it.
    let editing = $state<CommunitySummary>();
    let open = $state(false);
    let sheetKey = $state(0);
    useOverlay(
        overlays,
        () => open,
        () => (open = false),
    );

    function edit(community: CommunitySummary) {
        editing = community;
        sheetKey++;
        open = true;
    }
</script>

{#if $sortedCommunitiesStore.length === 0}
    <!-- nothing to name yet: where to find a community (the design has no empty state: GAPS.md) -->
    <div class="empty">
        <EmptyState
            preset="no-members"
            icon="users"
            title={$_("native.you.communities.none")}
            body={$_("native.you.communities.noneBody")}
            actionLabel={$_("communities.explore")}
            actionHandler={() => navigate("/communities")} />
    </div>
{:else}
    <p class="intro">{$_("native.you.communities.intro")}</p>
    <SettingsGroup label={$_("native.you.communities.names")}>
        {#each $sortedCommunitiesStore as community (community.id.communityId)}
            <SettingsLink
                label={community.name}
                value={community.membership.displayName ?? displayName}
                onClick={() => edit(community)} />
        {/each}
    </SettingsGroup>
{/if}

{#if editing !== undefined}
    {#key sheetKey}
        <CommunityNameSheet
            {open}
            community={editing}
            {displayName}
            onSaved={(message) => {
                open = false;
                context.toast(message);
            }}
            onClose={() => (open = false)} />
    {/key}
{/if}

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .empty {
        padding-top: 48px;
    }

    .intro {
        margin: 0;
        padding: 0 4px;
        font: var(--weight-regular) text-size(13.5px) / 1.5 var(--font-sans);
        color: var(--ink-3);
        text-wrap: pretty;
    }
</style>
