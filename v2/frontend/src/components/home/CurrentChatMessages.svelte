<script lang="ts">
    import { tick } from "svelte";
    import ChatMessage from "./ChatMessage.svelte";
    import { _ } from "svelte-i18n";
    import ArrowDown from "svelte-material-icons/ArrowDown.svelte";
    import { fade } from "svelte/transition";
    import { moreMessagesAvailable } from "../../fsm/chat.machine";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import type { ActorRefFrom } from "xstate";
    import Loading from "../Loading.svelte";
    import type { Message } from "../../domain/chat/chat";
    import Fab from "../Fab.svelte";
    import { rtlStore } from "../../stores/rtl";
    import { groupWhile } from "../../utils/list";
    import {
        addDays,
        areOnSameDay,
        getStartOfToday,
        toDayOfWeekString,
        toLongDateString,
    } from "../../utils/date";

    const MESSAGE_LOAD_THRESHOLD = 300;
    const FROM_BOTTOM_THRESHOLD = 600;
    const MERGE_MESSAGES_SENT_BY_SAME_USER_WITHIN_MILLIS = 60 * 1000; // 1 minute

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

    function scrollToIndex(index: number) {
        document
            .getElementById(`message-${index}`)
            ?.scrollIntoView({ behavior: "auto", block: "center" });
        setTimeout(() => machine.send({ type: "CLEAR_FOCUS_INDEX" }), 100);
    }

    function resetScroll() {
        if (initialised) {
            if ($machine.context.focusIndex) {
                scrollToIndex($machine.context.focusIndex);
            } else {
                const extraHeight = messagesDiv.scrollHeight - scrollHeight;
                messagesDiv.scrollTop = scrollTop + extraHeight;
            }
        } else {
            if ($machine.context.focusIndex) {
                scrollToIndex($machine.context.focusIndex);
            } else {
                scrollBottom();
            }
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

    function sameDate(a: Message, b: Message): boolean {
        return areOnSameDay(new Date(Number(a.timestamp)), new Date(Number(b.timestamp)));
    }

    function formatDate(timestamp: bigint): string {
        const date = new Date(Number(timestamp));

        const startOfToday = getStartOfToday();
        if (date >= startOfToday) {
            return $_("today");
        }
        const startOfYesterday = addDays(startOfToday, -1);
        if (date >= startOfYesterday) {
            return $_("yesterday");
        }
        const useDayNameOnly = date >= addDays(startOfToday, -6);
        return useDayNameOnly ? toDayOfWeekString(date) : toLongDateString(date);
    }

    function sameUser(a: Message, b: Message): boolean {
        return (
            a.sender === b.sender &&
            b.timestamp - a.timestamp < MERGE_MESSAGES_SENT_BY_SAME_USER_WITHIN_MILLIS
        );
    }

    function groupBySender(messages: Message[]): Message[][] {
        return groupWhile(sameUser, messages);
    }

    function groupMessages(messages: Message[]): Message[][][] {
        return groupWhile(sameDate, messages).map(groupBySender);
    }

    $: groupedMessages = groupMessages($machine.context.messages);

    // this is a horrible hack but I can't find any other solution to this problem
    let previous: any;
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

            if ($machine.matches("sending_message")) {
                tick().then(() => scrollBottom());
            }

            previous = $machine;
        }
    }

    // message grouping by date and user
    // then we need to figure out side loading new messages via polling
    // then we need to figure out loading new messages when we see the index has increased
    // then we need to integrate web rtc
    // message replies
    // jump to private reply from a group chat
</script>

<div bind:this={messagesDiv} class="chat-messages" on:scroll={onScroll}>
    {#if $machine.matches("loading_messages")}
        <div class="spinner">
            <Loading />
        </div>
    {/if}
    {#each groupedMessages as dayGroup}
        <div class="day-group">
            <div class="date-label">{formatDate(dayGroup[0][0]?.timestamp)}</div>
            {#each dayGroup as userGroup}
                {#each userGroup as msg, i (msg.messageIndex)}
                    <ChatMessage
                        showStem={i + 1 === userGroup.length}
                        on:chatWith
                        {machine}
                        {msg} />
                {/each}
            {/each}
        </div>
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
    .day-group {
        position: relative;

        .date-label {
            padding: $sp2;
            background-color: #ffffff;
            position: sticky;
            top: 0;
            width: 200px;
            opacity: 70%;
            margin: auto;
            border-radius: $sp4;
            @include z-index("date-label");
            @include font(book, normal, fs-70);
            text-align: center;
            margin-bottom: $sp4;
        }
    }

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
