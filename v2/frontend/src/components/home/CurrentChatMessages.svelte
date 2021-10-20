<svelte:options immutable={true} />

<script lang="ts">
    import { createEventDispatcher, onMount, setContext, tick } from "svelte";
    import ChatEvent from "./ChatEvent.svelte";
    import { _ } from "svelte-i18n";
    import ArrowDown from "svelte-material-icons/ArrowDown.svelte";
    import { fade } from "svelte/transition";
    import {
        moreNewMessagesAvailable,
        morePreviousMessagesAvailable,
    } from "../../fsm/chat.machine";
    import type { ChatEvents } from "../../fsm/chat.machine";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import type { ActorRefFrom } from "xstate";
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
    import { UnsupportedValueError } from "../../utils/error";
    import { toastStore } from "../../stores/toast";
    import { unconfirmed, unconfirmedReadByThem } from "../../stores/unconfirmed";
    import { userStore } from "../../stores/user";
    import type { UserLookup } from "../../domain/user/user";

    const MESSAGE_LOAD_THRESHOLD = 300;
    const FROM_BOTTOM_THRESHOLD = 600;
    const MESSAGE_READ_THRESHOLD = 500;

    const dispatch = createEventDispatcher();

    export let machine: ActorRefFrom<ChatMachine>;
    export let unreadMessages: number;

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
                                chatId: $machine.context.chatSummary.chatId,
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
            unreadMessages > 0
                ? firstUnreadMessageIndex
                : $machine.context.chatSummary.latestMessage?.event.messageIndex;
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
            machine.send({ type: "SET_FOCUS_MESSAGE_INDEX", data: index });
            scrollToElement(element);
            setTimeout(() => machine.send({ type: "CLEAR_FOCUS_INDEX" }), 200);
        } else {
            // todo - this is a bit dangerous as it could cause an infinite recursion
            // if we are looking for a message that simply isn't there.
            machine.send({ type: "GO_TO_MESSAGE_INDEX", data: index });
        }
    }

    function resetScroll() {
        if (initialised) {
            if ($machine.context.focusMessageIndex !== undefined) {
                scrollToMessageIndex($machine.context.focusMessageIndex);
            } else {
                const extraHeight = messagesDiv.scrollHeight - scrollHeight;
                messagesDiv.scrollTop = scrollTop + extraHeight;
            }
        } else {
            if ($machine.context.focusMessageIndex !== undefined) {
                scrollToMessageIndex($machine.context.focusMessageIndex);
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
                morePreviousMessagesAvailable($machine.context)
            ) {
                machine.send({ type: "LOAD_PREVIOUS_MESSAGES" });
            }

            fromBottomVal = fromBottom();
            if (
                fromBottomVal < MESSAGE_LOAD_THRESHOLD &&
                moreNewMessagesAvailable($machine.context)
            ) {
                machine.send({ type: "LOAD_NEW_MESSAGES" });
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
        const toggleArgs: ChatEvents = {
            type: "TOGGLE_REACTION",
            data: {
                messageId: ev.detail.message.messageId,
                reaction: ev.detail.reaction,
                userId: $machine.context.user!.userId,
            },
        };

        machine.send(toggleArgs);

        const apiPromise =
            $machine.context.chatSummary.kind === "group_chat"
                ? $machine.context.serviceContainer.toggleGroupChatReaction(
                      $machine.context.chatSummary.chatId,
                      ev.detail.message.messageId,
                      ev.detail.reaction
                  )
                : $machine.context.serviceContainer.toggleDirectChatReaction(
                      $machine.context.chatSummary.them,
                      ev.detail.message.messageId,
                      ev.detail.reaction
                  );

        apiPromise
            .then((resp) => {
                if (resp !== "added" && resp !== "removed") {
                    // toggle again to undo
                    console.log("Reaction failed: ", resp);
                    machine.send(toggleArgs);
                }
            })
            .catch((err) => {
                // toggle again to undo
                console.log("Reaction failed: ", err);
                machine.send(toggleArgs);
            });
    }

    function goToMessageIndex(ev: CustomEvent<number>) {
        scrollToMessageIndex(ev.detail);
    }

    function replyTo(ev: CustomEvent<EnhancedReplyContext>) {
        machine.send({ type: "REPLY_TO", data: ev.detail });
    }

    function replyPrivatelyTo(ev: CustomEvent<EnhancedReplyContext>) {
        machine.send({ type: "REPLY_PRIVATELY_TO", data: ev.detail });
    }

    function editEvent(ev: CustomEvent<EventWrapper<Message>>) {
        machine.send({ type: "EDIT_EVENT", data: ev.detail });
    }

    function deleteMessage(ev: CustomEvent<Message>) {
        machine.send({
            type: "DELETE_MESSAGE",
            data: { messageId: ev.detail.messageId, userId: $machine.context.user!.userId },
        });

        const apiPromise =
            $machine.context.chatSummary.kind === "group_chat"
                ? $machine.context.serviceContainer.deleteGroupMessage(
                      $machine.context.chatSummary.chatId,
                      ev.detail.messageId
                  )
                : $machine.context.serviceContainer.deleteDirectMessage(
                      $machine.context.chatSummary.them,
                      ev.detail.messageId
                  );

        apiPromise
            .then((resp) => {
                // check it worked - undo if it didn't
                if (resp !== "success") {
                    toastStore.showFailureToast("deleteFailed");
                    machine.send({
                        type: "UNDELETE_MESSAGE",
                        data: { message: ev.detail, userId: $machine.context.user!.userId },
                    });
                }
            })
            .catch((_err) => {
                toastStore.showFailureToast("deleteFailed");
                machine.send({
                    type: "UNDELETE_MESSAGE",
                    data: { message: ev.detail, userId: $machine.context.user!.userId },
                });
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
        if (
            first.event.kind === "participants_added" ||
            first.event.kind === "participant_left" ||
            first.event.kind === "participants_promoted_to_admin" ||
            first.event.kind === "participants_dismissed_as_admin" ||
            first.event.kind === "participants_removed" ||
            first.event.kind === "participant_joined" ||
            first.event.kind === "avatar_changed" ||
            first.event.kind === "desc_changed" ||
            first.event.kind === "reaction_added" ||
            first.event.kind === "reaction_removed" ||
            first.event.kind === "message_deleted" ||
            first.event.kind === "message_edited" ||
            first.event.kind === "name_changed"
        ) {
            return `${first.timestamp}_${first.index}`;
        }

        throw new UnsupportedValueError("Unexpected event type received", first.event);
    }

    $: groupedEvents = groupEvents($machine.context.events);

    $: firstUnreadMessageIndex = getFirstUnreadMessageIndex($machine.context.chatSummary);

    // todo - this might cause a performance problem
    $: admin =
        $machine.context.chatSummary.kind === "group_chat" &&
        $machine.context.chatSummary.participants.find(
            (p) => p.userId === $machine.context.user?.userId
        )?.role === "admin";

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
                        moreNewMessagesAvailable($machine.context)
                    ) {
                        machine.send({ type: "LOAD_NEW_MESSAGES" });
                    }
                    chatStore.clear();
                    break;
            }
        }
    }

    function isMe(evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message") {
            return evt.event.sender === $machine.context.user?.userId;
        }
        if (
            evt.event.kind === "direct_chat_created" ||
            evt.event.kind === "participants_added" ||
            evt.event.kind === "participants_removed" ||
            evt.event.kind === "participant_left" ||
            evt.event.kind === "participant_joined" ||
            evt.event.kind === "avatar_changed" ||
            evt.event.kind === "desc_changed" ||
            evt.event.kind === "name_changed" ||
            evt.event.kind === "reaction_added" ||
            evt.event.kind === "reaction_removed" ||
            evt.event.kind === "message_deleted" ||
            evt.event.kind === "message_edited" ||
            evt.event.kind === "participants_dismissed_as_admin" ||
            evt.event.kind === "participants_promoted_to_admin"
        ) {
            return false;
        }
        if (evt.event.kind === "group_chat_created") {
            return evt.event.created_by === $machine.context.user?.userId;
        }
        throw new UnsupportedValueError("Unexpected event type received", evt.event);
    }

    function isConfirmed(evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message") {
            return !$unconfirmed.has(evt.event.messageId);
        }
        return true;
    }

    function isReadByThem(evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message") {
            const confirmedRead = messageIsReadByThem($machine.context.chatSummary, evt.event);
            if (confirmedRead) {
                unconfirmedReadByThem.delete(evt.event.messageId);
            }
            return confirmedRead || $unconfirmedReadByThem.has(evt.event.messageId);
        }
        return true;
    }

    function isReadByMe(evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message") {
            return $machine.context.markRead.isRead(
                $machine.context.chatSummary.chatId,
                evt.event.messageIndex,
                evt.event.messageId
            );
        }
        return true;
    }
</script>

<div bind:this={messagesDiv} class="chat-messages" on:scroll={onScroll}>
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
                            evt.event.messageIndex === $machine.context.focusMessageIndex}
                        confirmed={isConfirmed(evt)}
                        readByThem={isReadByThem(evt)}
                        readByMe={isReadByMe(evt)}
                        chatId={$machine.context.chatSummary.chatId}
                        chatType={$machine.context.chatSummary.kind}
                        user={$machine.context.user}
                        me={isMe(evt)}
                        last={i + 1 === userGroup.length}
                        {admin}
                        on:chatWith
                        on:replyTo={replyTo}
                        on:replyPrivatelyTo={replyPrivatelyTo}
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
