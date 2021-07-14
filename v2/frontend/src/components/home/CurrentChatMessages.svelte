<script lang="ts">
    import { tick } from "svelte";
    import ChatMessage from "./ChatMessage.svelte";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import type { ActorRefFrom } from "xstate";
    import VirtualList from "../VirtualList.svelte";
    import Loading from "../Loading.svelte";

    const MESSAGE_LOAD_THRESHOLD = 300;

    export let machine: ActorRefFrom<ChatMachine>;

    let messagesDiv: HTMLDivElement;
    let initialised = false;
    // let start: number;
    // let end: number;
    let scrollHeight = 0;
    let currentChatId = "";

    function scrollBottom() {
        if (messagesDiv) {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
    }

    function resetScroll() {
        if (initialised) {
            const extraHeight = messagesDiv.scrollHeight - scrollHeight;
            messagesDiv.scrollTop = messagesDiv.scrollTop + extraHeight - 100; // 100 is the height of the spinner
        } else {
            scrollBottom();
            initialised = true;
        }
    }

    function onScroll() {
        if ($machine.matches("loaded_messages")) {
            if (messagesDiv.scrollTop < MESSAGE_LOAD_THRESHOLD) {
                machine.send({ type: "LOAD_MORE_MESSAGES" });

                // capture the current scrollheight
                scrollHeight = messagesDiv.scrollHeight;
            }
        }
    }

    $: {
        if ($machine.matches("loaded_messages") && $machine.history?.matches("loading_messages")) {
            tick().then(resetScroll);
        }
    }

    // when the selected chat changes we need to set initialised to false and resetScroll
    $: if ($machine.context.chatSummary.chatId !== currentChatId) {
        currentChatId = $machine.context.chatSummary.chatId;
        initialised = false;
    }
</script>

<div bind:this={messagesDiv} class="chat-messages" on:scroll={onScroll}>
    {#if $machine.matches("loading_messages")}
        <div class="spinner">
            <Loading />
        </div>
    {/if}
    {#each $machine.context.messages as msg, i}
        <ChatMessage {machine} {msg} />
    {/each}
    <!-- <VirtualList bind:start bind:end items={$machine.context.messages} let:item>
        <ChatMessage {machine} msg={item} />
    </VirtualList> -->
</div>

<style type="text/scss">
    .spinner {
        height: 100px;
    }
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
