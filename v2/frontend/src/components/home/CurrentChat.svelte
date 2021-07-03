<script lang="ts">
    import type { ChatDetails } from "../services/chats";

    import CurrentChatHeader from "../CurrentChatHeader.svelte";
    import CurrentChatMessages from "../CurrentChatMessages.svelte";
    import MessageEntry from "../MessageEntry.svelte";

    export let chat: ChatDetails;
</script>

<div class="wrapper">
    <CurrentChatHeader on:goback {chat} />
    <CurrentChatMessages {chat} />
    <MessageEntry />
</div>

<style type="text/scss">
    .wrapper {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 100%;
    }
</style>
