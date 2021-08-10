<script lang="ts">
    import { tick } from "svelte";
    import ChatEvent from "./ChatEvent.svelte";
    import { _ } from "svelte-i18n";
    import ArrowDown from "svelte-material-icons/ArrowDown.svelte";
    import { fade } from "svelte/transition";
    import { moreMessagesAvailable } from "../../fsm/chat.machine";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import type { ActorRefFrom } from "xstate";
    import Loading from "../Loading.svelte";
    import Fab from "../Fab.svelte";
    import { rtlStore } from "../../stores/rtl";
    import {
        addDays,
        getStartOfToday,
        toDayOfWeekString,
        toLongDateString,
    } from "../../utils/date";
    import type { EventWrapper } from "../../domain/chat/chat";
    import { getUnreadMessages, groupEvents } from "../../domain/chat/chat.utils";
    import { pop } from "../../utils/transition";

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

    function scrollToNew() {
        // todo - at this point we should *probably* fire off a message to update the lastReadByMe
        // the problem is that will make the new legend immediately disappear which is not quite what we
        // want. We'll come back to that.
        if (unreadMessages > 0) {
            scrollToElement(document.getElementById("new-msgs"), "smooth");
        } else {
            scrollBottom("smooth");
        }
    }

    function scrollToElement(element: HTMLElement | null, behavior: ScrollBehavior = "auto") {
        element?.scrollIntoView({ behavior, block: "center" });
    }

    function scrollToIndex(index: number) {
        scrollToElement(document.getElementById(`message-${index}`));
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
        if ($machine.matches({ user_states: "idle" })) {
            if (
                messagesDiv.scrollTop < MESSAGE_LOAD_THRESHOLD &&
                moreMessagesAvailable($machine.context)
            ) {
                machine.send({ type: "LOAD_PREVIOUS_MESSAGES" });
            }
            fromBottom =
                messagesDiv.scrollHeight -
                Math.abs(messagesDiv.scrollTop) -
                messagesDiv.clientHeight;
        }
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

    function finishedLoadingPreviousMessages() {
        return (
            $machine.matches({ user_states: "idle" }) &&
            $machine.history !== undefined &&
            $machine.history.matches({ user_states: "loading_previous_messages" })
        );
    }

    function shouldShowNewMessages() {
        return (
            $machine.matches({ loading_new_messages: "idle" }) &&
            $machine.history !== undefined &&
            $machine.history.matches({ loading_new_messages: "loading" }) &&
            fromBottom < FROM_BOTTOM_THRESHOLD
        );
    }

    function goToMessage(ev: CustomEvent<number>) {
        machine.send({ type: "GO_TO_MESSAGE_INDEX", data: ev.detail });
    }

    function dateGroupKey(group: EventWrapper[][]): string {
        const first = group[0] && group[0][0] && group[0][0].timestamp;
        return first ? new Date(Number(first)).toDateString() : "unknown";
    }

    function userGroupKey(group: EventWrapper[]): string {
        const first = group[0]!;
        if (first.event.kind !== "message") {
            // todo - we're going to have to come back to this
            throw new Error("Unexpected event type");
        }
        return `${first.event.sender}_${first.index}`;
    }

    $: groupedEvents = groupEvents($machine.context.events);

    $: unreadMessages = getUnreadMessages($machine.context.chatSummary);

    // this is a horrible hack but I can't find any other solution to this problem
    let previous: any;
    $: {
        if ($machine !== previous) {
            if ($machine.context.chatSummary.chatId !== currentChatId) {
                currentChatId = $machine.context.chatSummary.chatId;
                initialised = false;
            }

            if (finishedLoadingPreviousMessages()) {
                tick().then(resetScroll);
            }

            if (shouldShowNewMessages()) {
                tick().then(() => scrollBottom("smooth"));
            }

            if ($machine.matches({ user_states: "sending_message" })) {
                tick().then(() => scrollBottom("smooth"));
            }

            // capture the current scrollheight and scrollTop just before the new messages get rendered
            if (messagesDiv) {
                scrollHeight = messagesDiv.scrollHeight;
                scrollTop = messagesDiv.scrollTop;
            }

            previous = $machine;
        }
    }

    // then we need to integrate web rtc
</script>

<div bind:this={messagesDiv} class="chat-messages" on:scroll={onScroll}>
    {#if $machine.matches({ user_states: "loading_previous_messages" })}
        <div class="spinner">
            <Loading />
        </div>
    {/if}
    {#each groupedEvents as dayGroup, di (dateGroupKey(dayGroup))}
        <div class="day-group">
            <div class="date-label">
                {formatDate(dayGroup[0][0]?.timestamp)}
            </div>
            {#each dayGroup as userGroup, ui (userGroupKey(userGroup))}
                {#each userGroup as evt, i (evt.index)}
                    {#if evt.index === $machine.context.chatSummary.latestReadByMe + 1}
                        <div id="new-msgs" class="new-msgs">{$_("new")}</div>
                    {/if}
                    <ChatEvent
                        chatSummary={$machine.context.chatSummary}
                        user={$machine.context.user}
                        me={evt.event.kind === "message" &&
                            $machine.context.user?.userId === evt.event.sender}
                        last={i + 1 === userGroup.length}
                        userLookup={$machine.context.userLookup}
                        on:chatWith
                        on:goToMessage={goToMessage}
                        event={evt} />
                {/each}
            {/each}
        </div>
    {/each}
</div>

{#if fromBottom > FROM_BOTTOM_THRESHOLD}
    <!-- todo - this should scroll to the first unread message rather than to the bottom probably -->
    <div transition:fade class="to-bottom" class:rtl={$rtlStore}>
        <Fab on:click={() => scrollToNew()}>
            {#if unreadMessages > 0}
                <div in:pop={{ duration: 1500 }} class="unread">
                    <div class="unread-count">{unreadMessages > 99 ? "99+" : unreadMessages}</div>
                    <div class="unread-label">{$_("new")}</div>
                </div>
            {:else}
                <ArrowDown size={"1.2em"} color={"#fff"} />
            {/if}
        </Fab>
    </div>
{/if}

<style type="text/scss">
    .new-msgs {
        display: inline-block;
        color: #fff;
        @include font(light, normal, fs-100);
        margin-bottom: $sp4;
        margin-top: $sp4;

        &:after {
            content: "";
            width: 100%;
            border-top: 1px dotted #fff;
            display: block;
            position: absolute;
        }
    }

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

    .unread {
        color: var(--button-txt);
        text-align: center;
        text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.5);

        .unread-count {
            line-height: 80%;
        }
        .unread-label {
            @include font(book, normal, fs-70);
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
            -webkit-overflow-scrolling: touch;
        }
    }
</style>
