<!-- The signed-in (and guest) app: the shell with the regions the route asks for (router/regions.ts),
     each showing its screen (screens.ts), and the rail wired to the routes. -->
<script lang="ts">
    import {
        anonUserStore,
        chitStateStore,
        currentUserStore,
        favouritesStore,
        latestSuccessfulUpdatesLoop,
        OpenChat,
        publish,
        routeStore,
        sortedCommunitiesStore,
        subscribe,
        type CommunitySummary,
    } from "@client";
    import NavRail from "@openchat/ui/src/features/components/NavRail.svelte";
    import IconButton from "@openchat/ui/src/lib/components/IconButton.svelte";
    import { i18nKey } from "@i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import { navigate } from "@src/utils/navigation";
    import { addQueryStringParam, withQueryStringFlag } from "@src/utils/urls";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import {
        activityOverPage,
        narrowBack,
        railItems,
        railSelectionFor,
        type RailSelection,
        type Regions,
    } from "../../router/regions";
    import { DialogStack } from "../../shell/dialogStack.svelte";
    import { RailState } from "../../shell/railState.svelte";
    import { RightColumnState } from "../../shell/rightColumn.svelte";
    import Shell from "../../shell/Shell.svelte";
    import { currentShellLayout } from "../../shell/viewport.svelte";
    import DialogHost from "./DialogHost.svelte";
    import type { LocalDialog } from "./dialogs";
    import {
        dismissedRoute,
        subscribeAppEvents,
        type AppEventDialog,
    } from "@src/logic/appEvents/appEvents";
    import { pinsFor } from "../rail/rail.adapter";
    import { chitRailProps } from "../chit/chit.adapter";
    import AchievementToastHost from "../chit/AchievementToastHost.svelte";
    import { openLinked } from "./linkedDialogs";
    import { disableChit, hideChitIcon } from "@src/stores/settings";
    import { now500 } from "@src/stores/time";
    import DetailsColumn from "./DetailsColumn.svelte";
    import RegionScreen from "./RegionScreen.svelte";
    import { closeRightColumn, openOnNewPanel } from "./rightPanel";
    import { leftScreens, middleScreens, type ScreenContext } from "./screens";

    let { regions }: { regions: Extract<Regions, { area: "app" }> } = $props();

    const client = getContext<OpenChat>("client");

    const rightMode = $derived(currentShellLayout().right);
    const narrow = $derived(currentShellLayout().narrow);
    const rightColumn = new RightColumnState(() => rightMode);
    $effect(() => openOnNewPanel(rightColumn));
    // the rail's expanded state, remembered where it pushes the layout
    const railMode = $derived(currentShellLayout().rail);
    const railState = new RailState(() => railMode);
    // the dialogs the app opens itself, shown by DialogHost with the ones the URL opens
    const dialogStack = new DialogStack<LocalDialog>();

    // the activity feed opened over a page is Notifications' too
    const selection = $derived<RailSelection>(
        regions.left?.kind === "activity"
            ? { item: "notifications" }
            : railSelectionFor($routeStore),
    );
    const pins = $derived(
        pinsFor($sortedCommunitiesStore, (c: CommunitySummary) =>
            client.communityAvatarUrl(c.id.communityId, c.avatar),
        ),
    );
    const activePin = $derived.by(() => {
        const index = pins.findIndex((p) => p.id === selection.communityId);
        return index < 0 ? null : index;
    });
    const railShown = $derived(railItems($favouritesStore.size > 0, selection));
    // the labels are the app's own strings, translated here (the rail shows other text as it is)
    const items = $derived(railShown.map((item) => ({ icon: item.icon, label: $_(item.label) })));
    const activeItem = $derived(railShown.findIndex((item) => item.id === selection.item));
    // the rail's CHIT button, which opens ?chit (8d)
    const chit = $derived(
        chitRailProps(
            {
                chit: $chitStateStore,
                lastSync: $latestSuccessfulUpdatesLoop,
                disabled: $disableChit,
                now: $now500,
            },
            $hideChitIcon,
        ),
    );

    // a message that couldn't be sent and can't be retried says so (as the old UI's Home); one that
    // can shows as failed, with Retry
    $effect(() =>
        subscribe("sendMessageFailed", (alert) => {
            if (alert) toastStore.showFailureToast(i18nKey("errorSendingMessage"));
        }),
    );

    // the client couldn't bring an archived chat with unread messages out of the archive
    $effect(() =>
        subscribe("unarchiveChatFailed", () =>
            toastStore.showFailureToast(i18nKey("unarchiveChatFailed")),
        ),
    );

    // the client's app-wide events, as every tree handles them (app/src/logic/appEvents). Their
    // dialogs stay up through a navigation (the router's own, as a linked page loads, among
    // them), as the old Home's did, until the user closes one, which leaves the page
    let appDialog = $state<AppEventDialog | undefined>();
    $effect(() =>
        subscribeAppEvents(client, (outcome) => {
            if (outcome.kind === "show") {
                appDialog = outcome.dialog;
            } else {
                if (outcome.closeDialogs) publish("closeModalStack");
                navigate(outcome.path);
            }
        }),
    );

    function closeAppDialog() {
        const closing = appDialog;
        appDialog = undefined;
        // the others go away from what couldn't be shown; suspending a user stays where it was
        if (closing?.kind !== "suspending") navigate(dismissedRoute(client));
    }

    // Notifications over a chat or a wallet page opens the feed over it (decision 7), with its
    // own history entry; the other destinations are their paths
    function selectRail(i: number) {
        const item = railShown[i];
        if (item.id === "notifications" && activityOverPage(regions)) {
            if (regions.left?.kind !== "activity") {
                navigate(addQueryStringParam("panel", "activity"), "overlay");
            }
        } else {
            navigate(item.path);
        }
    }

    // the list a narrow screen goes back to from the middle
    const back = $derived(narrowBack(regions));

    // built once, each field read as it's used: a crossing of the narrow breakpoint doesn't touch a
    // screen that only reads the right column
    const context: ScreenContext = {
        dialogs: dialogStack,
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

{#snippet detailsColumn()}
    <DetailsColumn {context} />
{/snippet}

<Shell
    left={regions.left ? leftColumn : undefined}
    right={regions.rightColumn === false ? undefined : detailsColumn}
    narrowView={regions.narrowView}
    rightOpen={rightColumn.open}
    onCloseRight={() => closeRightColumn(rightColumn)}
    rightLabel="ui.panelCover.info">
    {#snippet rail()}
        <NavRail
            expanded={railState.expanded}
            onExpandedChange={(expanded) => (railState.expanded = expanded)}
            floating={railMode === "float"}
            {items}
            {pins}
            activeIndex={activeItem}
            {activePin}
            exploreActive={$routeStore.kind === "communities_route" ||
                $routeStore.kind === "welcome_route"}
            guest={$anonUserStore}
            homeHref="/"
            profileLabel={$currentUserStore.displayName ?? $currentUserStore.username}
            profileHandle={`@${$currentUserStore.username}`}
            onSelect={(i) => selectRail(i)}
            onSelectPin={(id) => navigate(`/community/${id}`)}
            onExplore={() => navigate("/communities")}
            onProfile={() => navigate(withQueryStringFlag("profile"), "overlay")}
            chitShown={!$anonUserStore && chit.chitShown}
            chitStreak={chit.chitStreak}
            chitClaimable={chit.chitClaimable}
            onChit={() => openLinked({ kind: "chit" })}
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

<!-- the dialogs: those the URL opens (?profile …), those the app opened itself, and the rules -->
<DialogHost stack={dialogStack} {appDialog} onCloseAppDialog={closeAppDialog} />
<AchievementToastHost dialogs={dialogStack} />

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
