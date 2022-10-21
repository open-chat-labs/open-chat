<script lang="ts">
    import ThreadPreviews from "./thread/ThreadPreviews.svelte";
    import Panel from "../Panel.svelte";
    import Loading from "../Loading.svelte";
    import { fade } from "svelte/transition";
    import NoChatSelected from "./NoChatSelected.svelte";
    import RecommendedGroups from "./RecommendedGroups.svelte";
    import type CurrentChatMessages from "./CurrentChatMessages.svelte";
    import CurrentChat from "./CurrentChat.svelte";
    import type { RemoteData } from "../../utils/remoteData";
    import type { GroupChatSummary, OpenChat } from "openchat-client";
    import { pathParams } from "../../stores/routing";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");

    export let loadingChats: boolean = false;
    export let hotGroups: RemoteData<GroupChatSummary[], string>;
    export let joining: GroupChatSummary | undefined;
    export let currentChatMessages: CurrentChatMessages | undefined;

    $: selectedChatStore = client.selectedChatStore;
    $: selectedChatId = client.selectedChatId;
    $: selectedServerChatStore = client.selectedServerChatStore;
    $: eventsStore = client.eventsStore;
    $: filteredProposalsStore = client.filteredProposalsStore;
    $: noChat = $pathParams.chatId === undefined;
    $: showThreads = $pathParams.chatId === "threads";
</script>

<Panel middle>
    {#if loadingChats || hotGroups.kind === "loading"}
        <Loading />
    {:else if showThreads}
        <ThreadPreviews />
    {:else if $selectedChatId === undefined}
        {#if hotGroups.kind === "success"}
            <RecommendedGroups
                {joining}
                on:cancelRecommendations
                on:joinGroup
                on:recommend
                on:dismissRecommendation
                groups={hotGroups.data} />
        {:else if noChat}
            <div class="no-chat" in:fade>
                <NoChatSelected on:recommend on:newchat />
            </div>
        {/if}
    {:else if $selectedChatStore !== undefined && $selectedServerChatStore !== undefined}
        <CurrentChat
            bind:currentChatMessages
            {joining}
            chat={$selectedChatStore}
            serverChat={$selectedServerChatStore}
            events={$eventsStore}
            filteredProposals={$filteredProposalsStore}
            on:unblockUser
            on:clearSelection
            on:blockUser
            on:leaveGroup
            on:replyPrivatelyTo
            on:addMembers
            on:showGroupDetails
            on:showProposalFilters
            on:showMembers
            on:chatWith
            on:joinGroup
            on:upgrade
            on:cancelPreview
            on:showPinned
            on:toggleMuteNotifications
            on:goToMessageIndex
            on:forward />
    {/if}
</Panel>

<style type="text/scss">
    .no-chat {
        height: 100%;
    }
</style>
