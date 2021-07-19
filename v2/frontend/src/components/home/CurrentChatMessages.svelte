<script lang="ts">
    import { tick } from "svelte";
    import ChatMessage from "./ChatMessage.svelte";
    import ArrowDown from "svelte-material-icons/ArrowDown.svelte";
    import { fade } from "svelte/transition";
    import { moreMessagesAvailable } from "../../fsm/chat.machine";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import type { ActorRefFrom } from "xstate";
    import Loading from "../Loading.svelte";
    import type { Message } from "../../domain/chat/chat";
    import Fab from "../Fab.svelte";
    import { rtlStore } from "../../stores/rtl";

    const MESSAGE_LOAD_THRESHOLD = 300;
    const FROM_BOTTOM_THRESHOLD = 600;

    export let machine: ActorRefFrom<ChatMachine>;

    // sucks that we can lie to the compiler like this so easily
    let messagesDiv: HTMLDivElement;
    let initialised = false;
    let scrollHeight = 0;
    let scrollTop = 0;
    let currentChatId = "";
    let fromBottom = 0;

    function scrollBottom(behavior: ScrollBehavior = "auto") {
        if (messagesDiv) {
            messagesDiv.scrollTo({
                top: messagesDiv.scrollHeight,
                behavior,
            });
        }
    }

    function resetScroll() {
        if (initialised) {
            if ($machine.context.focusIndex) {
                document
                    .getElementById(`message-${$machine.context.focusIndex}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                setTimeout(() => machine.send({ type: "CLEAR_FOCUS_INDEX" }), 1000);
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
            fromBottom =
                messagesDiv.scrollHeight -
                Math.abs(messagesDiv.scrollTop) -
                messagesDiv.clientHeight;
        }
    }

    // this is a horrible hack but I can't find any other solution to this problem
    let previous: any;
    let messages: Message[];
    $: {
        if ($machine !== previous) {
            if ($machine.context.chatSummary.chatId !== currentChatId) {
                currentChatId = $machine.context.chatSummary.chatId;
                initialised = false;
            }

            if ($machine.matches("loaded_messages")) {
                // capture the current scrollheight and scrollTop just before the new messages get rendered
                if (messagesDiv) {
                    scrollHeight = messagesDiv.scrollHeight;
                    scrollTop = messagesDiv.scrollTop;
                }
                tick().then(resetScroll);
            }

            previous = $machine;

            messages = $machine.context.messages;
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
    {#each messages as msg, i (msg.messageIndex)}
        <ChatMessage on:chatWith {machine} {msg} />
    {/each}
</div>

{#if fromBottom > FROM_BOTTOM_THRESHOLD}
    <div transition:fade class="to-bottom" class:rtl={$rtlStore}>
        <Fab on:click={() => scrollBottom("smooth")}>
            <ArrowDown size={"1.2em"} color={"#fff"} />
        </Fab>
    </div>
{/if}

<style type="text/scss">
    .spinner {
        height: 100px;
    }

    .to-bottom {
        position: absolute;
        bottom: 80px;
        right: 20px;

        &.rtl {
            left: $sp6;
            right: unset;
        }
    }

    .chat-messages {
        flex: 1;
        background-color: var(--currentChat-msgs-bg);
        padding: 10px 0;
        overflow-y: scroll;
        overflow-x: hidden;
        position: relative;
        @include size-below(xs) {
            padding: 10px;
        }
    }
</style>
