<svelte:options immutable={true} />

<script lang="ts">
    import { createEventDispatcher, onMount, setContext, tick } from "svelte";
    import ChatEvent from "./ChatEvent.svelte";
    import { _ } from "svelte-i18n";
    import ArrowDown from "svelte-material-icons/ArrowDown.svelte";
    import { fade } from "svelte/transition";
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
        ChatEvent as ChatEventType,
        Message,
    } from "../../domain/chat/chat";
    import {
        getFirstUnreadMessageIndex,
        groupEvents,
        messageIsReadByThem,
    } from "../../domain/chat/chat.utils";
    import { pop } from "../../utils/transition";
    import { toastStore } from "../../stores/toast";
    import { unconfirmed, unconfirmedReadByThem } from "../../stores/unconfirmed";
    import { userStore } from "../../stores/user";
    import type { UserLookup } from "../../domain/user/user";
    import type { ChatController } from "../../fsm/chat.controller";

    const MESSAGE_LOAD_THRESHOLD = 300;
    const FROM_BOTTOM_THRESHOLD = 600;
    const MESSAGE_READ_THRESHOLD = 500;

    const dispatch = createEventDispatcher();

    export let controller: ChatController;
    export let unreadMessages: number;

    $: events = controller.events;
    $: loading = controller.loading;
    $: chat = controller.chat;
    $: focusMessageIndex = controller.focusMessageIndex;

    setContext<UserLookup>("userLookup", $userStore);

    // sucks that we can lie to the compiler like this so easily
    let messagesDiv: HTMLDivElement;
    let initialised = false;
    let scrollHeight = 0;
    let scrollTop = 0;
    let currentChatId = "";
    let observer: IntersectionObserver;
    let messageReadTimers: Record<number, number> = {};
    let fromBottomVal: number = 0;

    onMount(() => {
        const options = {
            root: messagesDiv,
            rootMargin: "0px",
            threshold: 0.5,
        };

        observer = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
            entries.forEach((entry) => {
                const idxAttr = entry.target.attributes.getNamedItem("data-index");
                const idAttr = entry.target.attributes.getNamedItem("data-id");
                const idx = idxAttr ? parseInt(idxAttr.value, 10) : undefined;
                const id = idAttr ? BigInt(idAttr.value) : undefined;
                if (idx !== undefined && id !== undefined) {
                    if (entry.isIntersecting && messageReadTimers[idx] === undefined) {
                        const timer = setTimeout(() => {
                            dispatch("messageRead", {
                                chatId: controller.chatId,
                                messageIndex: idx,
                                messageId: id,
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
        const idx =
            unreadMessages > 0 ? firstUnreadMessageIndex : $chat.latestMessage?.event.messageIndex;
        if (idx !== undefined) {
            scrollToMessageIndex(idx);
        }
    }

    function scrollToElement(element: Element | null, behavior: ScrollBehavior = "auto") {
        element?.scrollIntoView({ behavior, block: "center" });
    }

    function scrollToMessageIndex(index: number) {
        const element = document.querySelector(`[data-index='${index}']`);
        if (element) {
            controller.setFocusMessageIndex(index);
            scrollToElement(element);
            setTimeout(() => controller.clearFocusMessageIndex(), 200);
        } else {
            // todo - this is a bit dangerous as it could cause an infinite recursion
            // if we are looking for a message that simply isn't there.
            controller.goToMessageIndex(index);
        }
    }

    function resetScroll() {
        if (initialised) {
            if ($focusMessageIndex !== undefined) {
                scrollToMessageIndex($focusMessageIndex);
            } else {
                const extraHeight = messagesDiv.scrollHeight - scrollHeight;
                messagesDiv.scrollTop = scrollTop + extraHeight;
            }
        } else {
            if ($focusMessageIndex !== undefined) {
                scrollToMessageIndex($focusMessageIndex);
            } else {
                scrollBottom();
            }
            initialised = true;
        }
    }

    function onScroll() {
        if (!$loading) {
            if (
                messagesDiv.scrollTop < MESSAGE_LOAD_THRESHOLD &&
                controller.morePreviousMessagesAvailable()
            ) {
                controller.loadPreviousMessages();
            }

            fromBottomVal = fromBottom();
            if (fromBottomVal < MESSAGE_LOAD_THRESHOLD && controller.moreNewMessagesAvailable()) {
                controller.loadPreviousMessages();
            }
        }
    }

    function fromBottom(): number {
        return messagesDiv
            ? messagesDiv.scrollHeight - Math.abs(messagesDiv.scrollTop) - messagesDiv.clientHeight
            : 0;
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

    function selectReaction(ev: CustomEvent<{ message: Message; reaction: string }>) {
        // optimistic update
        controller.toggleReaction(
            ev.detail.message.messageId,
            ev.detail.reaction,
            controller.user.userId
        );

        const apiPromise =
            $chat.kind === "group_chat"
                ? controller.api.toggleGroupChatReaction(
                      $chat.chatId,
                      ev.detail.message.messageId,
                      ev.detail.reaction
                  )
                : controller.api.toggleDirectChatReaction(
                      $chat.them,
                      ev.detail.message.messageId,
                      ev.detail.reaction
                  );

        apiPromise
            .then((resp) => {
                if (resp !== "added" && resp !== "removed") {
                    // toggle again to undo
                    controller.toggleReaction(
                        ev.detail.message.messageId,
                        ev.detail.reaction,
                        controller.user.userId
                    );
                }
            })
            .catch((err) => {
                // toggle again to undo
                console.log("Reaction failed: ", err);
                controller.toggleReaction(
                    ev.detail.message.messageId,
                    ev.detail.reaction,
                    controller.user.userId
                );
            });
    }

    function goToMessageIndex(ev: CustomEvent<number>) {
        scrollToMessageIndex(ev.detail);
    }

    function replyTo(ev: CustomEvent<EnhancedReplyContext>) {
        controller.replyTo(ev.detail);
    }

    function editEvent(ev: CustomEvent<EventWrapper<Message>>) {
        controller.editEvent(ev.detail);
    }

    function deleteMessage(ev: CustomEvent<Message>) {
        controller.deleteMessage(ev.detail.messageId, controller.user.userId);

        const apiPromise =
            $chat.kind === "group_chat"
                ? controller.api.deleteGroupMessage(controller.chatId, ev.detail.messageId)
                : controller.api.deleteDirectMessage($chat.them, ev.detail.messageId);

        apiPromise
            .then((resp) => {
                // check it worked - undo if it didn't
                if (resp !== "success") {
                    toastStore.showFailureToast("deleteFailed");
                    controller.undeleteMessage(ev.detail, controller.user.userId);
                }
            })
            .catch((_err) => {
                toastStore.showFailureToast("deleteFailed");
                controller.undeleteMessage(ev.detail, controller.user.userId);
            });
    }

    function dateGroupKey(group: EventWrapper<ChatEventType>[][]): string {
        const first = group[0] && group[0][0] && group[0][0].timestamp;
        return first ? new Date(Number(first)).toDateString() : "unknown";
    }

    function eventKey(e: EventWrapper<ChatEventType>): string | ChatEventType {
        if (e.event.kind === "message") {
            return e.event.messageId.toString();
        } else {
            return e.event;
            //return e.index.toString();
        }
    }

    function userGroupKey(group: EventWrapper<ChatEventType>[]): string {
        const first = group[0]!;
        if (first.event.kind === "message") {
            return `${first.event.sender}_${first.event.messageId}`;
        }
        if (first.event.kind === "direct_chat_created") {
            return `${first.event.kind}_${first.index}`;
        }
        if (first.event.kind === "group_chat_created") {
            return `${first.event.created_by}_${first.index}`;
        }
        return `${first.timestamp}_${first.index}`;
    }

    $: groupedEvents = groupEvents($events);

    $: console.log("Grouped events: ", groupedEvents);

    $: firstUnreadMessageIndex = getFirstUnreadMessageIndex($chat);

    // todo - this might cause a performance problem
    $: admin =
        $chat.kind === "group_chat" &&
        $chat.participants.find((p) => p.userId === controller.user?.userId)?.role === "admin";

    $: {
        if (controller.chatId !== currentChatId) {
            currentChatId = controller.chatId;
            initialised = false;
        }

        if (messagesDiv) {
            scrollHeight = messagesDiv.scrollHeight;
            scrollTop = messagesDiv.scrollTop;
        }

        if ($chatStore && $chatStore.chatId === controller.chatId) {
            fromBottomVal = fromBottom();
            switch ($chatStore.event.kind) {
                case "loaded_previous_messages":
                    tick().then(resetScroll);
                    chatStore.clear();
                    break;
                case "loaded_new_messages":
                    if (fromBottomVal < FROM_BOTTOM_THRESHOLD) {
                        scrollBottom("smooth");
                    }
                    chatStore.clear();
                    break;
                case "sending_message":
                    // if we are within the from bottom threshold *or* if the new message
                    // was sent by us, then scroll to the bottom
                    if (fromBottomVal < FROM_BOTTOM_THRESHOLD || $chatStore.event.sentByMe) {
                        // smooth scroll doesn't work here when we are leaping from the top
                        // which means we are stuck with abrupt scroll which is disappointing
                        scrollBottom($chatStore.event.scroll);
                    }
                    chatStore.clear();
                    break;
                case "chat_updated":
                    if (
                        fromBottomVal < MESSAGE_LOAD_THRESHOLD &&
                        controller.moreNewMessagesAvailable()
                    ) {
                        controller.loadNewMessages();
                    }
                    chatStore.clear();
                    break;
            }
        }
    }

    function isMe(evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message") {
            return evt.event.sender === controller.user?.userId;
        }
        if (evt.event.kind === "group_chat_created") {
            return evt.event.created_by === controller.user?.userId;
        }
        return false;
    }

    function isConfirmed(evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message") {
            return !$unconfirmed.has(evt.event.messageId);
        }
        return true;
    }

    function isReadByThem(evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message") {
            const confirmedRead = messageIsReadByThem($chat, evt.event);
            if (confirmedRead) {
                unconfirmedReadByThem.delete(evt.event.messageId);
            }
            return confirmedRead || $unconfirmedReadByThem.has(evt.event.messageId);
        }
        return true;
    }

    function isReadByMe(evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message") {
            return controller.isRead(evt.event.messageIndex, evt.event.messageId);
        }
        return true;
    }
</script>

<div bind:this={messagesDiv} class="chat-messages" on:scroll={onScroll} id="chat-messages">
    {#each groupedEvents as dayGroup, _di (dateGroupKey(dayGroup))}
        <div class="day-group">
            <div class="date-label">
                {formatDate(dayGroup[0][0]?.timestamp)}
            </div>
            {#each dayGroup as userGroup, _ui (userGroupKey(userGroup))}
                {#each userGroup as evt, i (eventKey(evt))}
                    {#if evt.event.kind === "message" && evt.event.messageIndex === firstUnreadMessageIndex}
                        <div id="new-msgs" class="new-msgs">{$_("new")}</div>
                    {/if}
                    <ChatEvent
                        {observer}
                        focused={evt.event.kind === "message" &&
                            evt.event.messageIndex === $focusMessageIndex}
                        confirmed={isConfirmed(evt)}
                        readByThem={isReadByThem(evt)}
                        readByMe={isReadByMe(evt)}
                        chatId={controller.chatId}
                        chatType={controller.kind}
                        user={controller.user}
                        me={isMe(evt)}
                        last={i + 1 === userGroup.length}
                        {admin}
                        on:chatWith
                        on:replyTo={replyTo}
                        on:replyPrivatelyTo
                        on:deleteMessage={deleteMessage}
                        on:editEvent={editEvent}
                        on:goToMessageIndex={goToMessageIndex}
                        on:selectReaction={selectReaction}
                        event={evt} />
                {/each}
            {/each}
        </div>
    {/each}
</div>

{#if fromBottomVal > FROM_BOTTOM_THRESHOLD || unreadMessages > 0}
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
