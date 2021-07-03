<script lang="ts">
    import { onMount } from "svelte";

    import type { ChatDetails } from "../services/chats";
    import ChatMessage from "./ChatMessage.svelte";
    export let chat: ChatDetails;

    let div: HTMLDivElement;
    function scrollBottom() {
        if (div) {
            div.scrollTop = div.scrollHeight;
        }
    }
    onMount(() => {
        scrollBottom();
    });
</script>

<div bind:this={div} class="chat-messages">
    {#each chat.messages as msg, i}
        <ChatMessage me={i % 2 === 0} {msg} />
    {/each}
</div>

<style type="text/scss">
    @import "../styles/mixins";
    .chat-messages {
        flex: 1;
        background-color: var(--currentChat-msgs-bg);
        padding: 10px 0;
        overflow: scroll;
        @include size-below(xs) {
            padding: 10px;
        }
    }
</style>
