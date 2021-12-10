<script lang="ts">
    import Panel from "../Panel.svelte";
    import Loading from "../Loading.svelte";
    import { fade } from "svelte/transition";
    import { ScreenWidth, screenWidth } from "../../stores/screenDimensions";
    import NoChatSelected from "./NoChatSelected.svelte";
    import CurrentChat from "./CurrentChat.svelte";
    import type { ChatController } from "../../fsm/chat.controller";
    export let controller: ChatController | undefined;
    export let loadingChats: boolean = false;
    export let blocked: boolean;
</script>

<Panel middle>
    {#if loadingChats}
        {#if $screenWidth === ScreenWidth.ExtraSmall}
            <div />
        {:else}
            <Loading />
        {/if}
    {:else if controller === undefined}
        <div class="no-chat" in:fade>
            <NoChatSelected on:newchat />
        </div>
    {:else}
        <CurrentChat
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
            on:chatWith />
    {/if}
</Panel>

<style type="text/scss">
    .no-chat {
        height: 100%;
    }
</style>
