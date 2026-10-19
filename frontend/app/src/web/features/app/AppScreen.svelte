<!-- The signed-in (and guest) app: the shell with the regions the route asks for (router/regions.ts),
     the rail wired to the routes. The regions are placeholders until their screens are built. -->
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

    function describe(middle: typeof regions.middle): [string, string] {
        switch (middle.kind) {
            case "conversation": {
                const r = middle.route;
                const parts = [JSON.stringify(r.chatId)];
                if (r.messageIndex !== undefined) parts.push(`message ${r.messageIndex}`);
                if (r.threadMessageIndex !== undefined) parts.push(`thread message ${r.threadMessageIndex}`);
                if (r.open) parts.push("thread open");
                return ["Conversation", parts.join(" · ")];
            }
            case "wallet":
                return [`Wallet: ${middle.view}`, middle.ledger ?? ""];
            case "explore":
                return ["Explore communities", ""];
            case "admin":
                return ["Platform operator console", ""];
            default:
                return ["Nothing selected", ""];
        }
    }

    function describeLeft(left: NonNullable<typeof regions.left>): [string, string] {
        switch (left.kind) {
            case "chats":
            case "threads":
                return [left.kind === "chats" ? "Chat list" : "Threads", JSON.stringify(left.scope)];
            case "activity":
                return ["Activity", ""];
            case "wallet":
                return ["Wallet panel", ""];
        }
    }
</script>

<!-- a route without a left column has none (ROUTES.md, Regions), and a narrow screen shows its middle -->
{#snippet leftColumn()}
    {#if regions.left}
        {@const [title, detail] = describeLeft(regions.left)}
        <Placeholder {title} {detail} />
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
        {@const [title, detail] = describe(regions.middle)}
        <div class="middle">
            <!-- TODO(phase 3): ConversationHeader's back button and panel toggle -->
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
            <Placeholder {title} {detail} />
        </div>
    {/snippet}
</Shell>

{#if profileOpen}
    <!-- TODO(phase 8): ProfileDialog -->
    <DialogShell
        title="Profile"
        onClose={() => navigate(removeQueryStringParam("profile"), "dismiss")}>
        <Placeholder title="Profile" detail="ProfileDialog (phase 8)" />
    </DialogShell>
{/if}

<style>
    .middle {
        position: relative;
        height: 100%;
    }

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
