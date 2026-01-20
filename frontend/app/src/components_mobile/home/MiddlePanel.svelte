<script lang="ts">
    import { trackedEffect } from "@src/utils/effects.svelte";
    import {
        botState,
        chatIdentifiersEqual,
        directChatBotsStore,
        filteredProposalsStore,
        publish,
        rightPanelMode,
        rightPanelWidth,
        routeStore,
        selectedChatIdStore,
        selectedChatSummaryStore,
        showMiddle,
        type ChatIdentifier,
    } from "openchat-client";
    import { tick } from "svelte";
    import { activeVideoCall, type ActiveVideoCall } from "../../stores/video";
    import { currentTheme } from "../../theme/themes";
    import ExploreCommunities from "./communities/explore/Explore.svelte";
    import CurrentChat from "./CurrentChat.svelte";

    let middlePanel: HTMLElement | undefined;

    let bot = $derived.by(() => {
        if ($selectedChatSummaryStore === undefined) return undefined;
        if ($selectedChatSummaryStore.kind !== "direct_chat") return undefined;
        return botState.externalBots.get($selectedChatSummaryStore.them.userId);
    });
    let uninstalledBot = $derived.by(() => {
        return bot !== undefined && $directChatBotsStore.get(bot.id) === undefined
            ? bot
            : undefined;
    });

    trackedEffect("installing-bot", () => {
        if (uninstalledBot !== undefined && $selectedChatSummaryStore !== undefined) {
            publish("installBot", { bot: uninstalledBot, collection: $selectedChatSummaryStore });
        }
    });

    function alignVideoCall(
        call: ActiveVideoCall | undefined,
        chatId: ChatIdentifier | undefined,
        rightPanelWidth: number | undefined,
        attempts: number = 0,
    ) {
        if (call && chatIdentifiersEqual(call.chatId, chatId) && middlePanel) {
            const callContainer = document.getElementById("video-call-container");
            const rect = middlePanel.getBoundingClientRect();
            if (callContainer) {
                if (call.view === "fullscreen") {
                    let width = window.innerWidth;
                    if (
                        $rightPanelMode !== "floating" &&
                        (call.threadOpen || call.participantsOpen)
                    ) {
                        width = width - (rightPanelWidth ?? 500);
                    }
                    callContainer.style.setProperty("left", `0px`);
                    callContainer.style.setProperty("width", `${width}px`);
                    callContainer.style.setProperty("top", `0px`);
                    callContainer.style.setProperty("height", `${window.innerHeight}px`);
                } else {
                    callContainer.style.setProperty("left", `${rect.left}px`);
                    callContainer.style.setProperty("width", `${rect.width}px`);
                    callContainer.style.setProperty("top", `${rect.top}px`);
                    callContainer.style.setProperty("height", `${rect.height}px`);
                }
            } else {
                // hack: there is a race condition here and it's possible we don't find the container on the first try
                if (attempts === 0) {
                    tick().then(() => alignVideoCall(call, chatId, attempts + 1));
                }
            }
        }
    }

    function resize() {
        alignVideoCall($activeVideoCall, $selectedChatIdStore, $rightPanelWidth);
    }
    $effect(() => {
        if (middlePanel) {
            resize();
        }
    });
</script>

<svelte:window onresize={resize} onorientationchange={resize} />

<section
    bind:this={middlePanel}
    class:visible={$showMiddle}
    class:halloween={$currentTheme.name === "halloween"}>
    {#if $routeStore.kind === "communities_route"}
        <ExploreCommunities />
    {:else if $selectedChatSummaryStore !== undefined}
        <CurrentChat chat={$selectedChatSummaryStore} filteredProposals={$filteredProposalsStore} />
    {/if}
</section>

<style lang="scss">
    section {
        min-width: 390px;
        overflow: auto;
        overflow-x: hidden;
        flex: 13;
        background: none;
        padding: 0;
        height: 100%;
        flex-direction: column;
        display: flex;

        @include mobile() {
            min-width: unset;
        }

        &.halloween::after {
            @include cobweb();
            bottom: 0;
            right: 0;
            transform: scaleY(-1);
        }

        &:not(.visible) {
            display: none;
        }
    }
</style>
