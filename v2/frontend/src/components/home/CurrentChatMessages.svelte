<script lang="ts">
    import { tick } from "svelte";
    import ChatMessage from "./ChatMessage.svelte";
    import { moreMessagesAvailable } from "../../fsm/chat.machine";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import type { ActorRefFrom } from "xstate";
    import VirtualList from "../VirtualList.svelte";
    import Loading from "../Loading.svelte";

    const MESSAGE_LOAD_THRESHOLD = 300;

    export let machine: ActorRefFrom<ChatMachine>;

    // sucks that we can lie to the compiler like this so easily
    let messagesDiv: HTMLDivElement;
    let initialised = false;
    // let start: number;
    // let end: number;
    let scrollHeight = 0;
    let scrollTop = 0;
    let currentChatId = "";

    function scrollBottom() {
        if (messagesDiv) {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
    }

    function resetScroll() {
        if (initialised) {
            if ($machine.context.focusIndex) {
                document
                    .getElementById(`message-${$machine.context.focusIndex}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                machine.send({ type: "CLEAR_FOCUS_INDEX" });
            } else {
                const extraHeight = messagesDiv.scrollHeight - scrollHeight;
                messagesDiv.scrollTop = scrollTop + extraHeight;
            }
        } else {
            scrollBottom();
            initialised = true;
        }
    }

    function onScroll() {
        if ($machine.matches("loaded_messages")) {
            if (
                messagesDiv.scrollTop < MESSAGE_LOAD_THRESHOLD &&
                moreMessagesAvailable($machine.context)
            ) {
                machine.send({ type: "LOAD_MORE_MESSAGES" });
            }
        }
    }

    // this is a horrible hack but I can't find any other solution to this problem
    let previous: any;
    $: {
        if ($machine !== previous) {
            if ($machine.context.chatSummary.chatId !== currentChatId) {
                currentChatId = $machine.context.chatSummary.chatId;
                initialised = false;
            }

            if (
                $machine.matches("loaded_messages") &&
                $machine.history?.matches("loading_messages")
            ) {
                // capture the current scrollheight and scrollTop just before the new messages get rendered
                if (messagesDiv) {
                    scrollHeight = messagesDiv.scrollHeight;
                    scrollTop = messagesDiv.scrollTop;
                }
                tick().then(resetScroll);
            }

            previous = $machine;
        }
    }

    // OK - tomorrow we need to figure out jumping to a distant message
    // replies:
    // private reply context

    // annotating the timeline with dates and times
    // then we need to figure out adding messages
    // then we need to figure out side loading new messages via polling
    // then we need to figure out loading new messages when we see the index has increased
    // then we need to integrate web rtc
</script>

<div bind:this={messagesDiv} class="chat-messages" on:scroll={onScroll}>
    {#if $machine.matches("loading_messages")}
        <div class="spinner">
            <Loading />
        </div>
    {/if}
    {#each $machine.context.messages as msg, i (msg.messageId)}
        <ChatMessage on:chatWith {machine} {msg} />
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
