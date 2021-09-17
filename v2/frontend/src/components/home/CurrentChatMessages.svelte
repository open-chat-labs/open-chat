<script lang="ts">
    import { onMount, tick } from "svelte";
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
    import { chatStore } from "../../stores/chat";
    import {
        addDays,
        getStartOfToday,
        toDayOfWeekString,
        toLongDateString,
    } from "../../utils/date";
    import type {
        EventWrapper,
        EnhancedReplyContext,
        ReplyContext,
        ChatEvent as ChatEventType,
        DirectChatReplyContext,
    } from "../../domain/chat/chat";
    import {
        getFirstUnreadMessageIndex,
        getUnreadMessages,
        groupEvents,
        messageIsReadByMe,
        messageIsReadByThem,
    } from "../../domain/chat/chat.utils";
    import { pop } from "../../utils/transition";
    import { UnsupportedValueError } from "../../utils/error";

    const MESSAGE_LOAD_THRESHOLD = 300;
    const FROM_BOTTOM_THRESHOLD = 600;
    const MESSAGE_READ_THRESHOLD = 500;

    export let machine: ActorRefFrom<ChatMachine>;
    export let unconfirmed: Set<bigint>;

    // sucks that we can lie to the compiler like this so easily
    let messagesDiv: HTMLDivElement;
    let initialised = false;
    let scrollHeight = 0;
    let scrollTop = 0;
    let currentChatId = "";
    let fromBottom = 0;
    let observer: IntersectionObserver;
    let messageReadTimers: Record<number, NodeJS.Timer> = {};

    onMount(() => {
        const options = {
            root: messagesDiv,
            rootMargin: "0px",
            threshold: 0.5,
        };

        observer = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
            entries.forEach((entry) => {
                const idAttr = entry.target.attributes.getNamedItem("data-index");
                const idx = idAttr ? parseInt(idAttr.value, 10) : undefined;
                if (idx !== undefined) {
                    if (entry.isIntersecting && messageReadTimers[idx] === undefined) {
                        const timer = setTimeout(() => {
                            machine.send({
                                type: "MESSAGE_READ_BY_ME",
                                data: {
                                    chatId: $machine.context.chatSummary.chatId,
                                    messageIndex: idx,
                                },
                            });
                            delete messageReadTimers[idx];
                        }, MESSAGE_READ_THRESHOLD);
                        messageReadTimers[idx] = timer;
                    }
                    if (!entry.isIntersecting && messageReadTimers[idx] !== undefined) {
                        clearTimeout(messageReadTimers[idx]);
                        delete messageReadTimers[idx];
                    }
                }
            });
        }, options);
    });

    function scrollBottom(behavior: ScrollBehavior = "auto") {
        // todo the problem here is that the height is affected by loading images
        // I'm going to wait until we load images via their own urls before trying any
        // harder to fix this.
        setTimeout(() => {
            if (messagesDiv) {
                messagesDiv.scrollTo({
                    top: messagesDiv.scrollHeight - messagesDiv.offsetHeight,
                    behavior,
                });
            }
        }, 0);
    }

    function scrollToNew() {
        // todo - at this point we should *probably* fire off a message to update the lastReadByMe
        // the problem is that will make the new legend immediately disappear which is not quite what we
        // want. We'll come back to that.
        if (unreadMessages > 0) {
            // todo - this is no good because the first unread message may not have been rendered yet
            // it's tempting to re-use the goToMessage func, but that uses *event* index
            // it *must* use event index as it potentially has to load new events and loading events
            // is done via event index range
            scrollToElement(document.getElementById("new-msgs"), "smooth");
        } else {
            scrollBottom("smooth");
        }
    }

    function scrollToElement(element: HTMLElement | null, behavior: ScrollBehavior = "auto") {
        element?.scrollIntoView({ behavior, block: "center" });
    }

    function scrollToIndex(index: number) {
        scrollToElement(document.getElementById(`event-${index}`));
        setTimeout(() => machine.send({ type: "CLEAR_FOCUS_INDEX" }), 200);
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

    function goToMessage(ev: CustomEvent<number>) {
        machine.send({ type: "GO_TO_EVENT_INDEX", data: ev.detail });
    }

    function replyTo(ev: CustomEvent<EnhancedReplyContext<ReplyContext>>) {
        machine.send({ type: "REPLY_TO", data: ev.detail });
    }

    function replyPrivatelyTo(ev: CustomEvent<EnhancedReplyContext<DirectChatReplyContext>>) {
        machine.send({ type: "REPLY_PRIVATELY_TO", data: ev.detail });
    }

    function dateGroupKey(group: EventWrapper<ChatEventType>[][]): string {
        const first = group[0] && group[0][0] && group[0][0].timestamp;
        return first ? new Date(Number(first)).toDateString() : "unknown";
    }

    function eventKey(e: EventWrapper<ChatEventType>): string {
        if (e.event.kind === "direct_message" || e.event.kind === "group_message") {
            return e.event.messageId.toString();
        } else {
            return e.index.toString();
        }
    }

    function userGroupKey(group: EventWrapper<ChatEventType>[]): string {
        const first = group[0]!;
        if (first.event.kind === "direct_message") {
            return `${first.event.sentByMe}_${first.index}`;
        }
        if (first.event.kind === "direct_chat_created") {
            return `${first.event.kind}_${first.index}`;
        }
        if (first.event.kind === "group_message") {
            return `${first.event.sender}_${first.index}`;
        }
        if (first.event.kind === "group_chat_created") {
            return `${first.event.created_by}_${first.index}`;
        }
        if (
            first.event.kind === "participants_added" ||
            first.event.kind === "participant_left" ||
            first.event.kind === "participants_promoted_to_admin" ||
            first.event.kind === "participants_dismissed_as_admin" ||
            first.event.kind === "participants_removed"
        ) {
            return `${first.timestamp}_${first.index}`;
        }

        throw new UnsupportedValueError("Unexpected event type received", first.event);
    }

    $: groupedEvents = groupEvents($machine.context.events);

    $: unreadMessages = getUnreadMessages($machine.context.chatSummary);

    $: firstUnreadMessageIndex = getFirstUnreadMessageIndex($machine.context.chatSummary);

    $: {
        if ($machine.context.chatSummary.chatId !== currentChatId) {
            currentChatId = $machine.context.chatSummary.chatId;
            initialised = false;
        }

        if (messagesDiv) {
            scrollHeight = messagesDiv.scrollHeight;
            scrollTop = messagesDiv.scrollTop;
        }

        if ($chatStore && $chatStore.chatId === $machine.context.chatSummary.chatId) {
            switch ($chatStore.event) {
                case "loaded_previous_messages":
                    tick().then(resetScroll);
                    chatStore.clear();
                    break;
                case "loaded_new_messages":
                    if (fromBottom < FROM_BOTTOM_THRESHOLD) {
                        scrollBottom("smooth");
                    }
                    chatStore.clear();
                    break;
                case "sending_message":
                    scrollBottom("smooth");
                    chatStore.clear();
                    break;
            }
        }
    }

    function isMe(evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "direct_message") {
            return evt.event.sentByMe;
        }
        if (
            evt.event.kind === "direct_chat_created" ||
            evt.event.kind === "participants_added" ||
            evt.event.kind === "participants_removed" ||
            evt.event.kind === "participant_left" ||
            evt.event.kind === "participants_dismissed_as_admin" ||
            evt.event.kind === "participants_promoted_to_admin"
        ) {
            return false;
        }
        if (evt.event.kind === "group_message") {
            return evt.event.sender === $machine.context.user?.userId;
        }
        if (evt.event.kind === "group_chat_created") {
            return evt.event.created_by === $machine.context.user?.userId;
        }
        throw new UnsupportedValueError("Unexpected event type received", evt.event);
    }

    function isConfirmed(evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "direct_message" || evt.event.kind === "group_message") {
            return !unconfirmed.has(evt.event.messageId);
        }
        return true;
    }

    function isReadByThem(evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "direct_message") {
            return messageIsReadByThem($machine.context.chatSummary, evt.event);
        }
        return true;
    }

    function isReadByMe(evt: EventWrapper<ChatEventType>): boolean {
        if (isMe(evt)) {
            return true;
        } else {
            if (evt.event.kind === "direct_message" || evt.event.kind === "group_message") {
                return messageIsReadByMe($machine.context.chatSummary, evt.event);
            }
        }
        return true;
    }

    // then we need to integrate web rtc
</script>

<div bind:this={messagesDiv} class="chat-messages" on:scroll={onScroll}>
    {#if $machine.matches({ user_states: "loading_previous_messages" })}
        <div class="spinner">
            <Loading />
        </div>
    {/if}
    {#each groupedEvents as dayGroup, _di (dateGroupKey(dayGroup))}
        <div class="day-group">
            <div class="date-label">
                {formatDate(dayGroup[0][0]?.timestamp)}
            </div>
            {#each dayGroup as userGroup, _ui (userGroupKey(userGroup))}
                {#each userGroup as evt, i (eventKey(evt))}
                    {#if (evt.event.kind === "group_message" || evt.event.kind === "direct_message") && evt.event.messageIndex === firstUnreadMessageIndex}
                        <div id="new-msgs" class="new-msgs">{$_("new")}</div>
                    {/if}
                    <ChatEvent
                        {observer}
                        focused={$machine.context.focusIndex === evt.index}
                        confirmed={isConfirmed(evt)}
                        readByThem={isReadByThem(evt)}
                        readByMe={isReadByMe(evt)}
                        chatSummary={$machine.context.chatSummary}
                        user={$machine.context.user}
                        me={isMe(evt)}
                        last={i + 1 === userGroup.length}
                        userLookup={$machine.context.userLookup}
                        on:chatWith
                        on:replyTo={replyTo}
                        on:replyPrivatelyTo={replyPrivatelyTo}
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
        flex: auto;
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
