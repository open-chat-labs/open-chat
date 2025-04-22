<script lang="ts">
    import { trackedEffect } from "@src/utils/effects.svelte";
    import {
        botState,
        chatIdentifiersEqual,
        filteredProposalsStore,
        installedDirectBots,
        pathState,
        selectedChatId,
        selectedChatStore,
        ui,
        type ChatIdentifier,
        type MultiUserChat,
    } from "openchat-client";
    import { tick } from "svelte";
    import { fade } from "svelte/transition";
    import { activeVideoCall, type ActiveVideoCall } from "../../stores/video";
    import { currentTheme } from "../../theme/themes";
    import UninstalledDirectBot from "../bots/UninstalledDirectBot.svelte";
    import Loading from "../Loading.svelte";
    import ExploreCommunities from "./communities/explore/Explore.svelte";
    import CurrentChat from "./CurrentChat.svelte";
    import NoChatSelected from "./NoChatSelected.svelte";
    import RecommendedGroups from "./RecommendedGroups.svelte";

    interface Props {
        joining: MultiUserChat | undefined;
    }

    let { joining }: Props = $props();

    let middlePanel: HTMLElement | undefined;

    let botId = $derived.by(() => {
        if ($selectedChatStore === undefined) return undefined;
        if ($selectedChatStore.kind !== "direct_chat") return undefined;
        return botState.externalBots.get($selectedChatStore.them.userId)?.id;
    });

    let uninstalledBotId = $derived.by(() => {
        return botId !== undefined && $installedDirectBots.get(botId) === undefined
            ? botId
            : undefined;
    });

    let installingBot = $state(false);
    trackedEffect("installing-bot", () => {
        if (uninstalledBotId !== undefined) {
            installingBot = true;
        }
    });

    function alignVideoCall(
        call: ActiveVideoCall | undefined,
        chatId: ChatIdentifier | undefined,
        attempts: number = 0,
    ) {
        if (call && chatIdentifiersEqual(call.chatId, chatId) && middlePanel) {
            const callContainer = document.getElementById("video-call-container");
            const rect = middlePanel.getBoundingClientRect();
            if (callContainer) {
                if (call.view === "fullscreen") {
                    let width = window.innerWidth;
                    if (
                        ui.rightPanelMode !== "floating" &&
                        (call.threadOpen || call.participantsOpen)
                    ) {
                        width = width - (ui.rightPanelWidth ?? 500);
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
        alignVideoCall($activeVideoCall, $selectedChatId);
    }
    let noChat = $derived(pathState.route.kind !== "global_chat_selected_route");
    trackedEffect("align-video-call", () => {
        if (middlePanel) {
            alignVideoCall($activeVideoCall, $selectedChatId);
        }
    });
</script>

<svelte:window onresize={resize} onorientationchange={resize} />

<section
    bind:this={middlePanel}
    class:visible={ui.showMiddle}
    class:offset={ui.showNav && !ui.showLeft}
    class:halloween={$currentTheme.name === "halloween"}>
    {#if pathState.route.kind === "explore_groups_route"}
        <RecommendedGroups {joining} />
    {:else if pathState.route.kind === "communities_route"}
        <ExploreCommunities />
    {:else if pathState.route.kind === "admin_route"}
        {#await import("./admin/Admin.svelte")}
            <div class="loading">
                <Loading />
            </div>
        {:then { default: Admin }}
            <Admin />
        {/await}
    {:else if $selectedChatId === undefined}
        {#if noChat}
            <div class="no-chat" in:fade>
                <NoChatSelected />
            </div>
        {/if}
    {:else if installingBot && botId && $selectedChatId.kind === "direct_chat"}
        <UninstalledDirectBot
            onClose={() => (installingBot = false)}
            chatId={$selectedChatId}
            {botId} />
    {:else if $selectedChatStore !== undefined}
        <CurrentChat
            {joining}
            chat={$selectedChatStore}
            filteredProposals={$filteredProposalsStore} />
    {/if}
</section>

<style lang="scss">
    .no-chat {
        height: 100%;
    }

    section {
        min-width: 390px;
        overflow: auto;
        overflow-x: hidden;
        flex: 13;
        background: none;
        padding: 0;

        @include mobile() {
            min-width: unset;
        }

        &.offset {
            margin-inline-start: toRem(80);
            @include mobile() {
                margin-inline-start: toRem(60);
            }
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
