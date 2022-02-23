<svelte:options immutable={true} />

<script lang="ts">
    import { createEventDispatcher, onMount, setContext, tick } from "svelte";
    import ChatEvent from "./ChatEvent.svelte";
    import { _ } from "svelte-i18n";
    import ArrowDown from "svelte-material-icons/ArrowDown.svelte";
    import Fab from "../Fab.svelte";
    import { rtlStore } from "../../stores/rtl";
    import {
        addDays,
        formatMessageDate,
        getStartOfToday,
        toDayOfWeekString,
        toLongDateString,
    } from "../../utils/date";
    import type {
        EventWrapper,
        EnhancedReplyContext,
        ChatEvent as ChatEventType,
        Message,
        Mention,
    } from "../../domain/chat/chat";
    import { groupEvents, messageIsReadByThem } from "../../domain/chat/chat.utils";
    import { pop } from "../../utils/transition";
    import { toastStore } from "../../stores/toast";
    import { unconfirmed, unconfirmedReadByThem } from "../../stores/unconfirmed";
    import { userStore } from "../../stores/user";
    import type { UserLookup } from "../../domain/user/user";
    import type { ChatController } from "../../fsm/chat.controller";
    import type { MessageReadState } from "../../stores/markRead";
    import { menuStore } from "../../stores/menu";
    import { iconSize } from "../../stores/iconSize";

    // todo - these thresholds need to be relative to screen height otherwise things get screwed up on (relatively) tall screens
    const MESSAGE_LOAD_THRESHOLD = 300;
    const FROM_BOTTOM_THRESHOLD = 600;
    const MESSAGE_READ_THRESHOLD = 500;

    const dispatch = createEventDispatcher();

    export let controller: ChatController;
    export let unreadMessages: number;
    export let preview: boolean;
    export let firstUnreadMention: Mention | undefined;
    export let firstUnreadMessage: number | undefined;

    $: loading = controller.loading;
    $: events = controller.events;
    $: chat = controller.chat;
    $: focusMessageIndex = controller.focusMessageIndex;
    $: markRead = controller.markRead;
    $: pinned = controller.pinnedMessages;

    setContext<UserLookup>("userLookup", $userStore);

    // treat this as if it might be null so we don't get errors when it's unmounted
    let messagesDiv: HTMLDivElement | undefined;
    let initialised = false;
    let scrollingToMessage = false;
    let scrollTimer: number | undefined;
    let currentChatId = "";
    let observer: IntersectionObserver;
    let messageReadTimers: Record<number, number> = {};
    let fromBottom: number = 0;
    let fromTop: number = 0;

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
                        const chatId = controller.chatId;
                        const timer = setTimeout(() => {
                            if (chatId === controller.chatId) {
                                dispatch("messageRead", {
                                    chatId,
                                    messageIndex: idx,
                                    messageId: id,
                                });
                            }
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
        messagesDiv?.scrollTo({
            top: 0,
            behavior,
        });
    }

    function scrollToNew() {
        const idx = firstUnreadMessage ?? $chat.latestMessage?.event.messageIndex;

        if (idx !== undefined) {
            scrollToMessageIndex(idx);
        }
    }

    function scrollToElement(element: Element | null, behavior: ScrollBehavior = "auto") {
        element?.scrollIntoView({ behavior, block: "center" });
    }

    function scrollToMention(mention: Mention | undefined) {
        if (mention !== undefined) {
            scrollToMessageIndex(mention.messageIndex);
        }
    }

    function scrollToMessageIndex(index: number) {
        // set a flag so that we can ignore subsequent scroll events temporarily
        scrollingToMessage = true;
        controller.setFocusMessageIndex(index);
        const element = document.querySelector(`[data-index='${index}']`);
        if (element) {
            // this triggers on scroll which will potentially load some new messages
            scrollToElement(element);
            setTimeout(() => {
                controller.clearFocusMessageIndex();
            }, 200);
        } else {
            // todo - this is a bit dangerous as it could cause an infinite recursion
            // if we are looking for a message that simply isn't there.
            // controller.goToMessageIndex(index).then(() => scrollToMessageIndex(index));
            controller.goToMessageIndex(index);
        }
    }

    function resetScroll() {
        if ($focusMessageIndex !== undefined) {
            scrollToMessageIndex($focusMessageIndex);
        }
        if (!initialised) {
            initialised = true;
        }
    }

    function shouldLoadPreviousMessages() {
        return fromTop < MESSAGE_LOAD_THRESHOLD && controller.morePreviousMessagesAvailable();
    }

    function shouldLoadNewMessages() {
        return fromBottom < MESSAGE_LOAD_THRESHOLD && controller.moreNewMessagesAvailable();
    }

    function onScroll() {
        if (!initialised) return;

        menuStore.hideMenu();

        if (scrollingToMessage) {
            // if we are in the middle of scrolling to a message we have to wait for the scroll to settle
            // down before we start paying attention to the scroll again
            // annoyingly there is no scrollEnd event or anything so this, hacky as it is, is the best we can do
            window.clearTimeout(scrollTimer);
            scrollTimer = window.setTimeout(() => {
                scrollingToMessage = false;

                // once the scrolling has settled we need to do a final check to see if we need to
                // load any more previous messages
                // the easiest way to do this is to manually call onScroll
                onScroll();
            }, 300); // todo this is a magic number and that usually ends badly
            return;
        }

        fromBottom = -(messagesDiv?.scrollTop ?? 0);
        fromTop = calculateFromTop();

        if (!$loading) {
            if (shouldLoadPreviousMessages()) {
                controller.loadPreviousMessages();
            }

            if (shouldLoadNewMessages()) {
                // Note - this fires even when we have entered our own message. This *seems* wrong but
                // it is actually correct because we do want to load our own messages from the server
                // so that any incorrect indexes are corrected and only the right thing goes in the cache
                controller.loadNewMessages();
            }
        }
    }

    function calculateFromTop(): number {
        return messagesDiv
            ? messagesDiv.scrollHeight - messagesDiv.clientHeight + messagesDiv.scrollTop
            : 0;
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

    function blockUser(ev: CustomEvent<{ userId: string }>) {
        controller.blockUser(ev.detail.userId);
    }

    $: groupedEvents = groupEvents($events).reverse();

    $: admin =
        $chat.kind === "group_chat" && ($chat.myRole === "admin" || $chat.myRole === "owner");

    $: isPublic = $chat.kind === "group_chat" && $chat.public;

    $: {
        if (controller.chatId !== currentChatId) {
            currentChatId = controller.chatId;
            initialised = false;
            fromBottom = 0;

            controller.subscribe((evt) => {
                switch (evt.event.kind) {
                    case "loaded_previous_messages":
                        tick().then(resetScroll);
                        break;
                    case "loaded_event_window":
                        const index = evt.event.messageIndex;
                        tick().then(() => scrollToMessageIndex(index));
                        initialised = true;
                        break;
                    case "loaded_new_messages":
                        // wait until the events are rendered
                        tick().then(() => {
                            // recalculate fromBottom
                            fromBottom = -(messagesDiv?.scrollTop ?? 0);
                            if (fromBottom < FROM_BOTTOM_THRESHOLD) {
                                // only scroll if we are now within threshold from the bottom
                                scrollBottom("smooth");
                            }
                        });
                        break;
                    case "sending_message":
                        // if we are within the from bottom threshold *or* if the new message
                        // was sent by us, then scroll to the bottom
                        if (evt.event.sentByMe || fromBottom < FROM_BOTTOM_THRESHOLD) {
                            // smooth scroll doesn't work here when we are leaping from the top
                            // which means we are stuck with abrupt scroll which is disappointing
                            const { scroll } = evt.event;
                            tick().then(() => scrollBottom(scroll));
                        }
                        break;
                    case "chat_updated":
                        if (
                            initialised &&
                            fromBottom < FROM_BOTTOM_THRESHOLD &&
                            shouldLoadNewMessages()
                        ) {
                            controller.loadNewMessages();
                        }
                        break;
                }
            });
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
            return !unconfirmed.contains(controller.chatId, evt.event.messageId);
        }
        return true;
    }

    function isReadByThem(readByThem: Set<bigint>, evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message") {
            const confirmedRead = messageIsReadByThem($chat, evt.event);
            if (confirmedRead && readByThem.has(evt.event.messageId)) {
                unconfirmedReadByThem.delete(evt.event.messageId);
            }
            return confirmedRead || readByThem.has(evt.event.messageId);
        }
        return true;
    }

    function isReadByMe(_store: MessageReadState, evt: EventWrapper<ChatEventType>): boolean {
        if (preview) return true;

        if (evt.event.kind === "message") {
            return controller.markRead.isRead(
                $chat.chatId,
                evt.event.messageIndex,
                evt.event.messageId
            );
        }
        return true;
    }

    function isPinned(store: Set<number>, evt: EventWrapper<ChatEventType>): boolean {
        if (preview) return false;

        if (evt.event.kind === "message") {
            return store.has(evt.event.messageIndex);
        }

        return false;
    }

    function pinMessage(ev: CustomEvent<Message>) {
        controller.pinMessage(ev.detail.messageIndex);
    }

    function unpinMessage(ev: CustomEvent<Message>) {
        controller.unpinMessage(ev.detail.messageIndex);
    }
</script>

<div bind:this={messagesDiv} class="chat-messages" on:scroll|passive={onScroll} id="chat-messages">
    {#each groupedEvents as dayGroup, _di (dateGroupKey(dayGroup))}
        <div class="day-group">
            <div class="date-label">
                {formatMessageDate(dayGroup[0][0]?.timestamp, $_("today"), $_("yesterday"))}
            </div>
            {#each dayGroup as userGroup, _ui (userGroupKey(userGroup))}
                {#each userGroup as evt, i (eventKey(evt))}
                    <ChatEvent
                        {observer}
                        focused={evt.event.kind === "message" &&
                            evt.event.messageIndex === $focusMessageIndex}
                        confirmed={isConfirmed(evt)}
                        readByThem={isReadByThem($unconfirmedReadByThem, evt)}
                        readByMe={isReadByMe($markRead, evt)}
                        chatId={controller.chatId}
                        chatType={controller.kind}
                        user={controller.user}
                        me={isMe(evt)}
                        first={i === 0}
                        last={i + 1 === userGroup.length}
                        {admin}
                        {preview}
                        {isPublic}
                        pinned={isPinned($pinned, evt)}
                        on:chatWith
                        on:replyTo={replyTo}
                        on:replyPrivatelyTo
                        on:deleteMessage={deleteMessage}
                        on:editEvent={editEvent}
                        on:goToMessageIndex={goToMessageIndex}
                        on:selectReaction={selectReaction}
                        on:blockUser={blockUser}
                        on:pinMessage={pinMessage}
                        on:unpinMessage={unpinMessage}
                        event={evt} />
                {/each}
            {/each}
        </div>
    {/each}
</div>

{#if !preview}
    <div
        title={$_("goToFirstMention")}
        class:show={firstUnreadMention !== undefined}
        class="fab mentions"
        class:rtl={$rtlStore}>
        <Fab on:click={() => scrollToMention(firstUnreadMention)}>
            <div in:pop={{ duration: 1500 }} class="unread">
                <div class="mention-count">@</div>
            </div>
        </Fab>
    </div>
{/if}

<div
    title={$_("goToFirstMessage")}
    class:show={fromBottom > FROM_BOTTOM_THRESHOLD || unreadMessages > 0}
    class="fab to-bottom"
    class:rtl={$rtlStore}>
    <Fab on:click={() => scrollToNew()}>
        {#if unreadMessages > 0}
            <div in:pop={{ duration: 1500 }} class="unread">
                <div class="unread-count">{unreadMessages > 99 ? "99+" : unreadMessages}</div>
                <div class="unread-label">{$_("new")}</div>
            </div>
        {:else}
            <ArrowDown size={$iconSize} color={"#fff"} />
        {/if}
    </Fab>
</div>

<style type="text/scss">
    .day-group {
        position: relative;

        .date-label {
            padding: $sp2;
            background-color: var(--currentChat-date-bg);
            position: sticky;
            top: 0;
            width: 200px;
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

    .fab {
        transition: opacity ease-in-out 300ms;
        position: absolute;
        right: 20px;
        opacity: 0;
        pointer-events: none;

        &.show {
            opacity: 1;
            pointer-events: all;
        }

        &.rtl {
            left: $sp6;
            right: unset;
        }
    }

    .mentions {
        bottom: 140px;

        .mention-count {
            @include font(bold, normal, fs-140);
        }
    }

    .to-bottom {
        bottom: 80px;
    }

    .chat-messages {
        flex: auto;
        background-color: var(--currentChat-msgs-bg);
        padding: $sp3 $sp3;
        overflow-x: hidden;
        overscroll-behavior-y: contain;
        position: relative;
        display: flex;
        flex-direction: column-reverse;

        @include nice-scrollbar();

        @include size-below(xs) {
            padding: 10px;
            -webkit-overflow-scrolling: touch;
        }
    }
</style>
