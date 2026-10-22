<!-- The right column: the panel rightPanelView (@client) picks for the last rightPanelHistory
     entry, the selected chat and the URL's open thread, shown through rightScreens. Nothing shows
     for a panel that doesn't fit the chat, or while a thread from the URL loads. -->
<script lang="ts">
    import {
        eventsStore,
        lastRightPanelState,
        rightPanelHistory,
        rightPanelView,
        selectedChatSummaryStore,
        selectedCommunitySummaryStore,
        threadOpenStore,
    } from "@client";
    import RegionScreen from "./RegionScreen.svelte";
    import { rightColumnPanel } from "./rightPanel";
    import { rightScreens, type RightRegion, type ScreenContext } from "./screens";

    let { context }: { context: ScreenContext } = $props();

    const view = $derived(
        rightPanelView({
            panel: rightColumnPanel($lastRightPanelState, $threadOpenStore),
            chatKind: $selectedChatSummaryStore?.kind,
            inCommunity: $selectedCommunitySummaryStore !== undefined,
            events: $eventsStore,
        }),
    );
    const region = $derived<RightRegion | undefined>(
        view.kind === "none" ? undefined : { ...view, back: $rightPanelHistory.length > 1 },
    );
</script>

{#if region !== undefined}
    <RegionScreen {region} screens={rightScreens} {context} column="right" />
{/if}
