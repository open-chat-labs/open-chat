<!-- The signed-in (and guest) app: the shell with the regions the route asks for (router/regions.ts),
     each showing its screen (screens.ts), and the rail wired to the routes. -->
<script lang="ts">
    import {
        anonUserStore,
        currentUserStore,
        OpenChat,
        querystringStore,
        routeForScope,
        routeStore,
        sortedCommunitiesStore,
        type CommunitySummary,
    } from "@client";
    import NavRail from "@openchat/ui/src/features/components/NavRail.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import IconButton from "@openchat/ui/src/lib/components/IconButton.svelte";
    import { navigate } from "@src/utils/navigation";
    import { removeQueryStringParam, withQueryStringFlag } from "@src/utils/urls";
    import { getContext } from "svelte";
    import { RAIL_ITEMS, railSelectionFor, type Regions } from "../../router/regions";
    import { RightColumnState } from "../../shell/rightColumn.svelte";
    import Shell from "../../shell/Shell.svelte";
    import { currentShellLayout } from "../../shell/viewport.svelte";
    import { pinsFor } from "../rail/rail.adapter";
    import Placeholder from "./Placeholder.svelte";
    import RegionScreen from "./RegionScreen.svelte";
    import { leftScreens, middleScreens, type ScreenContext } from "./screens";

    let { regions }: { regions: Extract<Regions, { area: "app" }> } = $props();

    const client = getContext<OpenChat>("client");

    const rightMode = $derived(currentShellLayout().right);
    const narrow = $derived(currentShellLayout().narrow);
    const rightColumn = new RightColumnState(() => rightMode);

    const selection = $derived(railSelectionFor($routeStore));
    const pins = $derived(
        pinsFor($sortedCommunitiesStore, (c: CommunitySummary) =>
            client.communityAvatarUrl(c.id.communityId, c.avatar),
        ),
    );
    const activePin = $derived.by(() => {
        const index = pins.findIndex((p) => p.id === selection.communityId);
        return index < 0 ? null : index;
    });
    const items = RAIL_ITEMS.map(({ icon }) => ({ icon }));

    // Dialogs people link to are query params over whatever page is open (ROUTES.md)
    const profileOpen = $derived($querystringStore.has("profile"));

    // the list a narrow screen goes back to from the middle
    const back = $derived(
        regions.left?.kind === "chats" || regions.left?.kind === "threads"
            ? routeForScope(regions.left.scope)
            : regions.left?.kind === "wallet"
              ? "/wallet"
              : undefined,
    );

    // built once, each field read as it's used: a crossing of the narrow breakpoint doesn't touch a
    // screen that only reads the right column
    const context: ScreenContext = {
        rightColumn,
        get narrow() {
            return narrow;
        },
        get back() {
            return back;
        },
    };
</script>

<!-- a route without a left column has none (ROUTES.md, Regions), and a narrow screen shows its middle -->
{#snippet leftColumn()}
    {#if regions.left}
        <RegionScreen region={regions.left} screens={leftScreens} {context} column="left" />
    {/if}
{/snippet}

<!-- TODO(phase 4): GroupPanel / DmPanel / ThreadPanel -->
{#snippet detailsColumn()}
    <Placeholder title="Details" detail="GroupPanel / DmPanel / ThreadPanel (phase 4)" />
{/snippet}

<Shell
    left={regions.left ? leftColumn : undefined}
    right={regions.rightColumn === false ? undefined : detailsColumn}
    narrowView={regions.narrowView}
    rightOpen={rightColumn.open}
    onCloseRight={() => (rightColumn.open = false)}
    rightLabel="ui.panelCover.info">
    {#snippet rail()}
        <NavRail
            {items}
            {pins}
            activeIndex={selection.item}
            {activePin}
            exploreActive={$routeStore.kind === "communities_route" ||
                $routeStore.kind === "welcome_route"}
            guest={$anonUserStore}
            homeHref="/"
            profileLabel={$currentUserStore.displayName ?? $currentUserStore.username}
            profileHandle={`@${$currentUserStore.username}`}
            onSelect={(i) => navigate(RAIL_ITEMS[i].path)}
            onSelectPin={(id) => navigate(`/community/${id}`)}
            onExplore={() => navigate("/communities")}
            onProfile={() => navigate(withQueryStringFlag("profile"), "overlay")}
            onSignIn={() => client.updateIdentityState({ kind: "logging_in" })} />
    {/snippet}
    {#snippet middle()}
        <RegionScreen
            region={regions.middle}
            screens={middleScreens}
            {context}
            column="middle"
            toolbar={middleToolbar} />
    {/snippet}
</Shell>

<!-- over a middle placeholder, or a screen still loading or that failed to: the back and panel
     buttons its screen will have (ConversationHeader's) -->
{#snippet middleToolbar()}
    <div class="toolbar">
        {#if narrow && back !== undefined}
            <IconButton
                icon="back"
                variant="ghost"
                label="ui.common.back"
                onClick={() => navigate(back)} />
        {/if}
        <span class="gap"></span>
        {#if regions.rightColumn !== false}
            <IconButton
                icon="panel"
                variant="ghost"
                pressed={rightColumn.open}
                label={rightColumn.open
                    ? "ui.conversationHeader.hidePanel"
                    : "ui.conversationHeader.showPanel"}
                onClick={() => rightColumn.toggle()} />
        {/if}
    </div>
{/snippet}

{#if profileOpen}
    <!-- TODO(phase 8): ProfileDialog -->
    <DialogShell
        title="Profile"
        onClose={() => navigate(removeQueryStringParam("profile"), "dismiss")}>
        <Placeholder title="Profile" detail="ProfileDialog (phase 8)" />
    </DialogShell>
{/if}

<style>
    .toolbar {
        position: absolute;
        inset-block-start: var(--space-12);
        inset-inline: var(--space-12);
        display: flex;
    }

    .gap {
        flex: 1;
    }
</style>
