<script lang="ts">
    import ThreadPreviews from "./thread/ThreadPreviews.svelte";
    import Panel from "../Panel.svelte";
    import Loading from "../Loading.svelte";
    import { fade } from "svelte/transition";
    import NoChatSelected from "./NoChatSelected.svelte";
    import RecommendedGroups from "./RecommendedGroups.svelte";
    import CurrentChat from "./CurrentChat.svelte";
    import type { ChatController } from "../../fsm/chat.controller";
    import type { RemoteData } from "../../utils/remoteData";
    import type { GroupChatSummary } from "../../domain/chat/chat";
    import { pathParams } from "../../stores/routing";
    import { selectedChatStore } from "../../stores/chat";

    export let controller: ChatController | undefined;
    export let loadingChats: boolean = false;
    export let hotGroups: RemoteData<GroupChatSummary[], string>;
    export let joining: GroupChatSummary | undefined;

    $: noChat = $pathParams.chatId === undefined;
    $: showThreads = $pathParams.chatId === "threads";
</script>

<Panel middle>
    {#if loadingChats || hotGroups.kind === "loading"}
        <Loading />
    {:else if showThreads}
        <ThreadPreviews />
    {:else if controller === undefined}
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
    {:else if $selectedChatStore !== undefined}
        <CurrentChat
            {joining}
            {controller}
            chat={$selectedChatStore}
            on:initiateThread
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
            on:openThread
            on:goToMessageIndex
            on:closeThread
            on:forward />
    {/if}
</Panel>

<style type="text/scss">
    .no-chat {
        height: 100%;
    }
</style>
