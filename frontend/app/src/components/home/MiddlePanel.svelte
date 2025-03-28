<script lang="ts">
    import { fade } from "svelte/transition";
    import NoChatSelected from "./NoChatSelected.svelte";
    import RecommendedGroups from "./RecommendedGroups.svelte";
    import ExploreCommunities from "./communities/explore/Explore.svelte";
    import type CurrentChatMessages from "./CurrentChatMessages.svelte";
    import CurrentChat from "./CurrentChat.svelte";
    import {
        chatIdentifiersEqual,
        type ChatIdentifier,
        type MultiUserChat,
        selectedChatStore,
        selectedChatId,
        eventsStore,
        filteredProposalsStore,
        externalBots,
        installedDirectBots,
    } from "openchat-client";
    import { pathParams } from "../../routes";
    import { tick } from "svelte";
    import { currentTheme } from "../../theme/themes";
    import { layoutStore, type Layout, rightPanelWidth } from "../../stores/layout";
    import Loading from "../Loading.svelte";
    import { activeVideoCall, type ActiveVideoCall } from "../../stores/video";
    import UninstalledDirectBot from "../bots/UninstalledDirectBot.svelte";

    interface Props {
        joining: MultiUserChat | undefined;
        currentChatMessages: CurrentChatMessages | undefined;
    }

    let { joining, currentChatMessages = $bindable() }: Props = $props();

    let middlePanel: HTMLElement | undefined;

    let botId = $derived.by(() => {
        if ($selectedChatStore === undefined) return undefined;
        if ($selectedChatStore.kind !== "direct_chat") return undefined;
        return $externalBots.get($selectedChatStore.them.userId)?.id;
    });

    let uninstalledBotId = $derived.by(() => {
        return botId !== undefined && $installedDirectBots.get(botId) === undefined
            ? botId
            : undefined;
    });

    let installingBot = $state(false);
    $effect(() => {
        if (uninstalledBotId !== undefined) {
            installingBot = true;
        }
    });

    function alignVideoCall(
        call: ActiveVideoCall | undefined,
        chatId: ChatIdentifier | undefined,
        layout: Layout,
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
                        layout.rightPanel !== "floating" &&
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
                    tick().then(() =>
                        alignVideoCall(call, chatId, layout, rightPanelWidth, attempts + 1),
                    );
                }
            }
        }
    }

    function resize() {
        alignVideoCall($activeVideoCall, $selectedChatId, $layoutStore, $rightPanelWidth);
    }
    let noChat = $derived($pathParams.kind !== "global_chat_selected_route");
    $effect(() => {
        if (middlePanel) {
            alignVideoCall($activeVideoCall, $selectedChatId, $layoutStore, $rightPanelWidth);
        }
    });
</script>

<svelte:window onresize={resize} onorientationchange={resize} />

<section
    bind:this={middlePanel}
    class:offset={$layoutStore.showNav && !$layoutStore.showLeft}
    class:halloween={$currentTheme.name === "halloween"}>
    {#if $pathParams.kind === "explore_groups_route"}
        <RecommendedGroups {joining} on:joinGroup on:leaveGroup />
    {:else if $pathParams.kind === "communities_route"}
        <ExploreCommunities on:createCommunity />
    {:else if $pathParams.kind === "admin_route"}
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
                <NoChatSelected on:newchat />
            </div>
        {/if}
    {:else if installingBot && botId && $selectedChatId.kind === "direct_chat"}
        <UninstalledDirectBot
            onClose={() => (installingBot = false)}
            chatId={$selectedChatId}
            {botId} />
    {:else if $selectedChatStore !== undefined}
        <CurrentChat
            bind:currentChatMessages
            {joining}
            chat={$selectedChatStore}
            events={$eventsStore}
            filteredProposals={$filteredProposalsStore}
            on:successfulImport
            on:clearSelection
            on:leaveGroup
            on:showProposalFilters
            on:makeProposal
            on:joinGroup
            on:claimDailyChit
            on:toggleMuteNotifications
            on:goToMessageIndex
            on:convertGroupToCommunity
            on:forward />
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
    }
</style>
