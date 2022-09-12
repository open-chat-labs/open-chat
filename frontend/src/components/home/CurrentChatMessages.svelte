<svelte:options immutable={true} />

<script lang="ts">
    import { afterUpdate, beforeUpdate, createEventDispatcher, onMount, tick } from "svelte";
    import ChatEvent from "./ChatEvent.svelte";
    import Robot from "../Robot.svelte";
    import ProposalBot from "../ProposalBot.svelte";
    import { _ } from "svelte-i18n";
    import ArrowDown from "svelte-material-icons/ArrowDown.svelte";
    import Fab from "../Fab.svelte";
    import { rtlStore } from "../../stores/rtl";
    import { formatMessageDate } from "../../utils/date";
    import type {
        EventWrapper,
        EnhancedReplyContext,
        ChatEvent as ChatEventType,
        Message,
        Mention,
        ChatSummary,
    } from "../../domain/chat/chat";
    import {
        containsReaction,
        groupEvents,
        messageIsReadByThem,
        sameUser,
    } from "../../domain/chat/chat.utils";
    import { pop } from "../../utils/transition";
    import { unconfirmed, unconfirmedReadByThem } from "../../stores/unconfirmed";
    import type { ChatController } from "../../fsm/chat.controller";
    import { MessageReadState, messagesRead } from "../../stores/markRead";
    import { menuStore } from "../../stores/menu";
    import { tooltipStore } from "../../stores/tooltip";
    import { iconSize } from "../../stores/iconSize";
    import InitialGroupMessage from "./InitialGroupMessage.svelte";
    import { userStore } from "../../stores/user";
    import { RelayedEvent, relaySubscribe, relayUnsubscribe } from "../../stores/relay";
    import { trackEvent } from "../../utils/tracking";
    import * as shareFunctions from "../../domain/share";
    import { isProposalGroup } from "../../stores/chat";
    import {
        FilteredProposals,
        toggleProposalFilterMessageExpansion,
        filteredProposalsStore,
    } from "../../stores/filteredProposals";
    import { groupWhile } from "../../utils/list";
    import { pathParams } from "../../stores/routing";
    import {
        eventsStore,
        focusMessageIndex,
        currentChatPinnedMessages,
        currentChatEditingEvent,
    } from "../../stores/chat";

    // todo - these thresholds need to be relative to screen height otherwise things get screwed up on (relatively) tall screens
    const MESSAGE_LOAD_THRESHOLD = 400;
    const FROM_BOTTOM_THRESHOLD = 600;
    const MESSAGE_READ_THRESHOLD = 500;

    const dispatch = createEventDispatcher();

    export let controller: ChatController;
    export let unreadMessages: number;
    export let preview: boolean;
    export let firstUnreadMention: Mention | undefined;
    export let firstUnreadMessage: number | undefined;
    export let canPin: boolean;
    export let canBlockUser: boolean;
    export let canDelete: boolean;
    export let canSend: boolean;
    export let canReact: boolean;
    export let canInvite: boolean;
    export let footer: boolean;
    export let canReplyInThread: boolean;

    $: chat = controller.chat;
    $: isBot = $chat.kind === "direct_chat" && $userStore[$chat.them]?.kind === "bot";

    let loadingPrev = false;
    let loadingNew = false;

    // treat this as if it might be null so we don't get errors when it's unmounted
    let messagesDiv: HTMLDivElement | undefined;
    let messagesDivHeight: number;
    let initialised = false;
    let scrollingToMessage = false;
    let scrollTimer: number | undefined;
    let currentChatId = "";
    let observer: IntersectionObserver;
    let messageReadTimers: Record<number, number> = {};
    let insideFromBottomThreshold: boolean = false;
    let morePrevAvailable = controller.morePreviousMessagesAvailable();
    let previousScrollHeight: number | undefined = undefined;

    onMount(() => {
        const options = {
            root: messagesDiv as Element,
            rootMargin: "0px",
            threshold: [0.1, 0.2, 0.3, 0.4, 0.5],
        };

        observer = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
            entries.forEach((entry) => {
                const idxAttr = entry.target.attributes.getNamedItem("data-index");
                const idAttr = entry.target.attributes.getNamedItem("data-id");
                const idx = idxAttr ? parseInt(idxAttr.value, 10) : undefined;
                const id = idAttr ? BigInt(idAttr.value) : undefined;
                if (idx !== undefined && id !== undefined) {
                    const intersectionRatioRequired =
                        0 < messagesDivHeight && messagesDivHeight < entry.boundingClientRect.height
                            ? (messagesDivHeight * 0.5) / entry.boundingClientRect.height
                            : 0.5;

                    const isIntersecting = entry.intersectionRatio >= intersectionRatioRequired;
                    if (isIntersecting && messageReadTimers[idx] === undefined) {
                        const chatId = controller.chatId;
                        const timer = window.setTimeout(() => {
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
                    if (!isIntersecting && messageReadTimers[idx] !== undefined) {
                        clearTimeout(messageReadTimers[idx]);
                        delete messageReadTimers[idx];
                    }
                }
            });
        }, options);

        // this is where we pick up events that may be published from a thread
        relaySubscribe((event: RelayedEvent) => {
            if (event.kind === "relayed_delete_message") {
                deleteMessage(event.message);
            }

            if (event.kind === "relayed_select_reaction") {
                onSelectReaction(event);
            }

            if (event.kind === "relayed_register_vote") {
                controller.registerPollVote(
                    undefined,
                    event.data.messageId,
                    event.data.messageIndex,
                    event.data.answerIndex,
                    event.data.type
                );
            }
        });

        return relayUnsubscribe;
    });

    beforeUpdate(() => (previousScrollHeight = messagesDiv?.scrollHeight));

    afterUpdate(() => {
        setIfInsideFromBottomThreshold();
        morePrevAvailable = controller.morePreviousMessagesAvailable();
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
            scrollToMessageIndex(idx, false);
        }
    }

    function scrollToElement(element: Element | null, behavior: ScrollBehavior = "auto") {
        element?.scrollIntoView({ behavior, block: "center" });
    }

    function scrollToMention(mention: Mention | undefined) {
        if (mention !== undefined) {
            scrollToMessageIndex(mention.messageIndex, false);
        }
    }

    function scrollToMessageIndex(
        index: number,
        preserveFocus: boolean,
        loadWindowIfMissing: boolean = true,
        focusThreadMessageIndex: number | undefined = undefined
    ) {
        if (index < 0) {
            focusMessageIndex.set(controller.chatId, undefined);
            return;
        }

        // set a flag so that we can ignore subsequent scroll events temporarily
        scrollingToMessage = true;
        focusMessageIndex.set(controller.chatId, index);
        const element = document.querySelector(`[data-index='${index}']`);
        if (element) {
            // this triggers on scroll which will potentially load some new messages
            scrollToElement(element);
            const msgEvent = controller.findMessageEvent($eventsStore, index);
            if (msgEvent) {
                if (msgEvent.event.thread !== undefined && $pathParams.open) {
                    dispatch("openThread", {
                        rootEvent: msgEvent,
                        focusThreadMessageIndex,
                    });
                } else {
                    dispatch("closeThread");
                }
            }
            if (!preserveFocus) {
                setTimeout(() => {
                    focusMessageIndex.set(controller.chatId, undefined);
                }, 200);
            }
        } else if (loadWindowIfMissing) {
            controller.goToMessageIndex(index, preserveFocus);
        }
    }

    function resetScroll() {
        if ($focusMessageIndex !== undefined) {
            scrollToMessageIndex($focusMessageIndex, false);
        }
        if (!initialised) {
            initialised = true;
        }
    }

    function shouldLoadPreviousMessages() {
        morePrevAvailable = controller.morePreviousMessagesAvailable();
        return !loadingPrev && calculateFromTop() < MESSAGE_LOAD_THRESHOLD && morePrevAvailable;
    }

    function shouldLoadNewMessages() {
        return (
            !loadingNew &&
            calculateFromBottom() < MESSAGE_LOAD_THRESHOLD &&
            controller.moreNewMessagesAvailable()
        );
    }

    let expectedScrollTop: number | undefined = undefined;

    function scrollLeapDetected() {
        return (
            expectedScrollTop !== undefined &&
            expectedScrollTop - (messagesDiv?.scrollTop ?? 0) > 500
        );
    }

    function onScroll() {
        if (!initialised) return;

        if (scrollLeapDetected()) {
            console.log("scroll: position has leapt unacceptably", messagesDiv?.scrollTop);
            messagesDiv?.scrollTo({ top: expectedScrollTop, behavior: "auto" }); // this should trigger another call to onScroll
            expectedScrollTop = undefined;
            return;
        } else {
            expectedScrollTop = undefined;
        }

        menuStore.hideMenu();
        tooltipStore.hide();

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

        if (shouldLoadPreviousMessages()) {
            loadingPrev = true;
            controller.loadPreviousMessages();
        }

        if (shouldLoadNewMessages()) {
            // Note - this fires even when we have entered our own message. This *seems* wrong but
            // it is actually correct because we do want to load our own messages from the server
            // so that any incorrect indexes are corrected and only the right thing goes in the cache
            loadingNew = true;
            controller.loadNewMessages();
        }

        setIfInsideFromBottomThreshold();
    }

    function calculateFromTop(): number {
        return messagesDiv
            ? messagesDiv.scrollHeight - messagesDiv.clientHeight + messagesDiv.scrollTop
            : 0;
    }

    function calculateFromBottom(): number {
        return -(messagesDiv?.scrollTop ?? 0);
    }

    function onSelectReaction({ message, reaction }: { message: Message; reaction: string }) {
        if (!canReact) return;

        const kind = containsReaction(controller.user.userId, reaction, message.reactions)
            ? "remove"
            : "add";

        controller.selectReaction(undefined, message.messageId, reaction, kind).then((success) => {
            if (success && kind === "add") {
                trackEvent("reacted_to_message");
            }
        });
    }

    function onSelectReactionEv(ev: CustomEvent<{ message: Message; reaction: string }>) {
        onSelectReaction(ev.detail);
    }

    function goToMessageIndex(ev: CustomEvent<{ index: number; preserveFocus: boolean }>) {
        scrollToMessageIndex(ev.detail.index, ev.detail.preserveFocus);
    }

    function replyTo(ev: CustomEvent<EnhancedReplyContext>) {
        if (!canSend) return;
        dispatch("replyTo", ev.detail);
    }

    function editEvent(ev: CustomEvent<EventWrapper<Message>>) {
        controller.editEvent(ev.detail);
    }

    function onDeleteMessage(ev: CustomEvent<Message>) {
        deleteMessage(ev.detail);
    }

    function deleteMessage(message: Message) {
        if (!canDelete && controller.user.userId !== message.sender) return;

        controller.deleteMessage(undefined, message.messageId);
    }

    function dateGroupKey(group: EventWrapper<ChatEventType>[][]): string {
        const first = group[0] && group[0][0] && group[0][0].timestamp;
        return first ? new Date(Number(first)).toDateString() : "unknown";
    }

    function eventKey(e: EventWrapper<ChatEventType>): string {
        if (e.event.kind === "message") {
            return e.event.messageId.toString();
        } else {
            return e.index.toString();
        }
    }

    function blockUser(ev: CustomEvent<{ userId: string }>) {
        if (!canBlockUser) return;
        controller.blockUser(ev.detail.userId);
    }

    $: groupedEvents = groupEvents($eventsStore, groupInner($filteredProposalsStore)).reverse();

    $: {
        if (controller.chatId !== currentChatId) {
            currentChatId = controller.chatId;
            initialised = false;

            controller.subscribe((evt) => {
                switch (evt.event.kind) {
                    case "loaded_previous_events":
                        tick()
                            .then(() => (initialised = true))
                            .then(resetScroll)
                            .then(() => {
                                expectedScrollTop = messagesDiv?.scrollTop ?? 0;
                            })
                            .then(() => (loadingPrev = false))
                            .then(loadMoreIfRequired);
                        break;
                    case "loaded_event_window":
                        const index = evt.event.messageIndex;
                        const preserveFocus = evt.event.preserveFocus;
                        const allowRecursion = evt.event.allowRecursion;
                        const focusThreadMessageIndex = evt.event.focusThreadMessageIndex;
                        tick()
                            .then(() => (initialised = true))
                            .then(() => {
                                expectedScrollTop = undefined;
                                scrollToMessageIndex(
                                    index,
                                    preserveFocus,
                                    allowRecursion,
                                    focusThreadMessageIndex
                                );
                            })
                            .then(loadMoreIfRequired);
                        break;
                    case "loaded_new_events":
                        const newLatestMessage = evt.event.newLatestMessage;
                        // wait until the events are rendered
                        tick()
                            .then(() => {
                                setIfInsideFromBottomThreshold();
                                if (newLatestMessage && insideFromBottomThreshold) {
                                    // only scroll if we are now within threshold from the bottom
                                    scrollBottom("smooth");
                                } else if (
                                    messagesDiv?.scrollTop === 0 &&
                                    previousScrollHeight !== undefined
                                ) {
                                    const clientHeightChange =
                                        messagesDiv.scrollHeight - previousScrollHeight;
                                    if (clientHeightChange > 0) {
                                        messagesDiv.scrollTop = -clientHeightChange;
                                        console.log(
                                            "scrollTop updated from 0 to " + messagesDiv.scrollTop
                                        );
                                    }
                                }
                            })
                            .then(() => (loadingNew = false))
                            .then(loadMoreIfRequired);
                        break;
                    case "sending_message":
                        // smooth scroll doesn't work here when we are leaping from the top
                        // which means we are stuck with abrupt scroll which is disappointing
                        const { scroll } = evt.event;
                        tick().then(() => scrollBottom(scroll));
                        break;
                    case "chat_updated":
                        if (initialised && insideFromBottomThreshold && shouldLoadNewMessages()) {
                            controller.loadNewMessages();
                        }
                        break;
                }
            });
        }
    }

    function setIfInsideFromBottomThreshold() {
        insideFromBottomThreshold = calculateFromBottom() < FROM_BOTTOM_THRESHOLD;
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

    /**
     * When we load an event window, it is possible that there are not enough *visible* events
     * either above the focus message or below the focus message to allow scrolling. If that is the case
     * we must trigger the loading of more messages (either previous messages or subsequent messages or both)
     *
     * Note that both loading new events and loading previous events can themselves trigger more "recursion" if
     * there *still* are not enough visible events 🤯
     */
    function loadMoreIfRequired() {
        if (shouldLoadNewMessages()) {
            loadingNew = true;
            controller.loadNewMessages();
        }
        if (shouldLoadPreviousMessages()) {
            loadingPrev = true;
            controller.loadPreviousMessages();
        }
    }

    function isConfirmed(evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message") {
            return !unconfirmed.contains(controller.chatId, evt.event.messageId);
        }
        return true;
    }

    function isReadByThem(
        chat: ChatSummary,
        readByThem: Set<bigint>,
        evt: EventWrapper<ChatEventType>
    ): boolean {
        if (evt.event.kind === "message") {
            const confirmedRead = messageIsReadByThem(chat, evt.event);
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
            return messagesRead.isRead($chat.chatId, evt.event.messageIndex, evt.event.messageId);
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
        if (!canPin) return;
        controller.pinMessage(ev.detail.messageIndex);
    }

    function unpinMessage(ev: CustomEvent<Message>) {
        if (!canPin) return;
        controller.unpinMessage(ev.detail.messageIndex);
    }

    function registerVote(
        ev: CustomEvent<{
            messageId: bigint;
            messageIndex: number;
            answerIndex: number;
            type: "register" | "delete";
        }>
    ) {
        controller.registerPollVote(
            undefined,
            ev.detail.messageId,
            ev.detail.messageIndex,
            ev.detail.answerIndex,
            ev.detail.type
        );
    }

    function shareMessage(ev: CustomEvent<Message>) {
        shareFunctions.shareMessage(
            controller.user.userId,
            ev.detail.sender === controller.user.userId,
            ev.detail
        );
    }

    function copyMessageUrl(ev: CustomEvent<Message>) {
        shareFunctions.copyMessageUrl(controller.chatId, ev.detail.messageIndex);
    }

    function isCollapsed(
        ew: EventWrapper<ChatEventType>,
        filteredProposals: FilteredProposals | undefined
    ): boolean {
        return ew.event.kind === "message" && isCollpasedProposal(ew.event, filteredProposals);
    }

    function toggleMessageExpansion(ew: EventWrapper<ChatEventType>, expand: boolean) {
        if (ew.event.kind === "message" && ew.event.content.kind === "proposal_content") {
            toggleProposalFilterMessageExpansion(ew.event.messageId, expand);
        }
    }

    function groupInner(filteredProposals: FilteredProposals | undefined) {
        return (events: EventWrapper<ChatEventType>[]) => {
            return groupWhile((a, b) => inSameGroup(a, b, filteredProposals), events);
        };
    }

    // Each expanded proposal should be in a group by itself
    // All collapsed proposals should be grouped together
    // Otherwise group by sender
    function inSameGroup(
        a: EventWrapper<ChatEventType>,
        b: EventWrapper<ChatEventType>,
        filteredProposals: FilteredProposals | undefined
    ): boolean {
        if (a.event.kind === "message" && b.event.kind === "message") {
            const aKind = a.event.content.kind;
            const bKind = b.event.content.kind;
            if (aKind === "proposal_content" || bKind === "proposal_content") {
                return (
                    isCollpasedProposal(a.event, filteredProposals) &&
                    isCollpasedProposal(b.event, filteredProposals)
                );
            } else {
                return sameUser(a, b);
            }
        }
        return false;
    }

    function isCollpasedProposal(
        message: Message,
        filteredProposals: FilteredProposals | undefined
    ): boolean {
        if (message.content.kind !== "proposal_content") return false;
        return filteredProposals?.isCollapsed(message.messageId, message.content.proposal) ?? false;
    }
</script>

<div
    bind:this={messagesDiv}
    bind:clientHeight={messagesDivHeight}
    class="chat-messages"
    on:scroll={onScroll}
    id="chat-messages">
    {#each groupedEvents as dayGroup, _di (dateGroupKey(dayGroup))}
        <div class="day-group">
            <div class="date-label">
                {formatMessageDate(dayGroup[0][0]?.timestamp, $_("today"), $_("yesterday"))}
            </div>
            {#each dayGroup as innerGroup, _ui (controller.userGroupKey(innerGroup))}
                {#each innerGroup as evt, i (eventKey(evt))}
                    <ChatEvent
                        {observer}
                        focused={evt.event.kind === "message" &&
                            evt.event.messageIndex === $focusMessageIndex}
                        confirmed={isConfirmed(evt)}
                        readByThem={isReadByThem($chat, $unconfirmedReadByThem, evt)}
                        readByMe={isReadByMe($messagesRead, evt)}
                        chatId={controller.chatId}
                        chatType={controller.kind}
                        user={controller.user}
                        me={isMe(evt)}
                        first={i === 0}
                        last={i + 1 === innerGroup.length}
                        {preview}
                        {canPin}
                        {canBlockUser}
                        {canDelete}
                        {canSend}
                        {canReact}
                        {canInvite}
                        {canReplyInThread}
                        collapsed={isCollapsed(evt, $filteredProposalsStore)}
                        supportsEdit={true}
                        supportsReply={true}
                        inThread={false}
                        publicGroup={controller.chatVal.kind === "group_chat" &&
                            controller.chatVal.public}
                        pinned={isPinned($currentChatPinnedMessages, evt)}
                        editing={$currentChatEditingEvent === evt}
                        on:chatWith
                        on:initiateThread
                        on:replyTo={replyTo}
                        on:replyPrivatelyTo
                        on:deleteMessage={onDeleteMessage}
                        on:editEvent={editEvent}
                        on:goToMessageIndex={goToMessageIndex}
                        on:selectReaction={onSelectReactionEv}
                        on:blockUser={blockUser}
                        on:pinMessage={pinMessage}
                        on:unpinMessage={unpinMessage}
                        on:registerVote={registerVote}
                        on:copyMessageUrl={copyMessageUrl}
                        on:shareMessage={shareMessage}
                        on:expandMessage={() => toggleMessageExpansion(evt, true)}
                        on:collapseMessage={() => toggleMessageExpansion(evt, false)}
                        on:upgrade
                        on:forward
                        event={evt} />
                {/each}
            {/each}
        </div>
    {/each}
    {#if initialised && !morePrevAvailable}
        {#if $isProposalGroup}
            <ProposalBot />
        {:else if $chat.kind === "group_chat"}
            <InitialGroupMessage group={$chat} noVisibleEvents={$eventsStore.length === 0} />
        {:else if isBot}
            <Robot />
        {/if}
    {/if}
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
    class:show={!insideFromBottomThreshold || unreadMessages > 0}
    class="fab to-bottom"
    class:footer
    class:rtl={$rtlStore}>
    <Fab on:click={() => scrollToNew()}>
        {#if unreadMessages > 0}
            <div in:pop={{ duration: 1500 }} class="unread">
                <div class="unread-count">{unreadMessages > 999 ? "999+" : unreadMessages}</div>
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
            padding: $sp2 10px;
            background-color: var(--currentChat-date-bg);
            position: sticky;
            top: 0;
            width: fit-content;
            min-width: 100px;
            margin: auto;
            border-radius: 12px;
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
    }

    .fab {
        transition: opacity ease-in-out 300ms;
        position: absolute;
        @include z-index("fab");
        right: 20px;
        bottom: 0;
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
        bottom: 24px;
        &.footer {
            bottom: 80px;
        }
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

        @include mobile() {
            padding: 10px;
            -webkit-overflow-scrolling: touch;
        }
    }
</style>
