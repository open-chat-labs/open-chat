<script lang="ts">
    import Panel from "../Panel.svelte";
    import Loading from "../Loading.svelte";
    import { fade } from "svelte/transition";
    import NoChatSelected from "./NoChatSelected.svelte";
    import RecommendedGroups from "./RecommendedGroups.svelte";
    import CurrentChat from "./CurrentChat.svelte";
    import type { ChatController } from "../../fsm/chat.controller";
    import type { RemoteData } from "../../utils/remoteData";
    import type { GroupChatSummary } from "../../domain/chat/chat";

    export let controller: ChatController | undefined;
    export let loadingChats: boolean = false;
    export let blocked: boolean;
    export let hotGroups: RemoteData<GroupChatSummary[], string>;
    export let joining: GroupChatSummary | undefined;
</script>

<Panel middle>
    {#if loadingChats || hotGroups.kind === "loading"}
        <Loading />
    {:else if controller === undefined}
        {#if hotGroups.kind === "success"}
            <RecommendedGroups
                {joining}
                on:cancelRecommendations
                on:joinGroup
                on:recommend
                on:dismissRecommendation
                groups={hotGroups.data} />
        {:else}
            <div class="no-chat" in:fade>
                <NoChatSelected on:recommend on:newchat />
            </div>
        {/if}
    {:else}
        <CurrentChat
            {joining}
            {blocked}
            {controller}
            on:unblockUser
            on:clearSelection
            on:blockUser
            on:leaveGroup
            on:replyPrivatelyTo
            on:addParticipants
            on:showGroupDetails
            on:showParticipants
            on:chatWith
            on:joinGroup
            on:upgrade
            on:cancelPreview
            on:showPinned
            on:goToMessageIndex
            on:showFaqQuestion
            on:forward />
    {/if}
</Panel>

<style type="text/scss">
    .no-chat {
        height: 100%;
    }
</style>
