<svelte:options immutable={true} />

<script lang="ts">
    import {
        afterUpdate,
        beforeUpdate,
        createEventDispatcher,
        getContext,
        onMount,
        tick,
    } from "svelte";
    import Avatar from "../Avatar.svelte";
    import ChatEvent from "./ChatEvent.svelte";
    import Robot from "../Robot.svelte";
    import ProposalBot from "../ProposalBot.svelte";
    import { _ } from "svelte-i18n";
    import ArrowDown from "svelte-material-icons/ArrowDown.svelte";
    import Fab from "../Fab.svelte";
    import { rtlStore } from "../../stores/rtl";
    import {
        AvatarSize,
        EventWrapper,
        EnhancedReplyContext,
        ChatEvent as ChatEventType,
        Message,
        Mention,
        ChatSummary,
        OpenChat,
        FilteredProposals,
        MessageReadState,
        LoadedNewMessages,
        ChatUpdated,
        LoadedMessageWindow,
        LoadedPreviousMessages,
        SentMessage,
        FailedMessages,
    } from "openchat-client";
    import { pop } from "../../utils/transition";
    import { menuStore } from "../../stores/menu";
    import { tooltipStore } from "../../stores/tooltip";
    import { iconSize } from "../../stores/iconSize";
    import InitialGroupMessage from "./InitialGroupMessage.svelte";
    import { pathParams } from "../../stores/routing";
    import { push } from "svelte-spa-router";
    import { isSafari } from "../../utils/devices";

    // todo - these thresholds need to be relative to screen height otherwise things get screwed up on (relatively) tall screens
    const MESSAGE_LOAD_THRESHOLD = 400;
    const FROM_BOTTOM_THRESHOLD = 600;
    const MESSAGE_READ_THRESHOLD = 500;

    const client = getContext<OpenChat>("client");
    const user = client.user;
    const dispatch = createEventDispatcher();

    export let chat: ChatSummary;
    export let unreadMessages: number;
    export let readonly: boolean;
    export let firstUnreadMention: Mention | undefined;
    export let canPin: boolean;
    export let canBlockUser: boolean;
    export let canDelete: boolean;
    export let canSend: boolean;
    export let canReact: boolean;
    export let canInvite: boolean;
    export let footer: boolean;
    export let canReplyInThread: boolean;
    export let events: EventWrapper<ChatEventType>[];
    export let filteredProposals: FilteredProposals | undefined;

    $: isProposalGroup = client.isProposalGroup;
    $: currentChatEditingEvent = client.currentChatEditingEvent;
    $: currentChatPinnedMessages = client.currentChatPinnedMessages;
    $: messagesRead = client.messagesRead;
    $: unconfirmedReadByThem = client.unconfirmedReadByThem;
    $: unconfirmed = client.unconfirmed;
    $: failedMessagesStore = client.failedMessagesStore;
    $: userGroupKeys = client.userGroupKeys;
    $: currentChatDraftMessage = client.currentChatDraftMessage;
    $: focusMessageIndex = client.focusMessageIndex;
    $: chatStateStore = client.chatStateStore;
    $: userStore = client.userStore;
    $: showAvatar = initialised && shouldShowAvatar(chat, events[0]?.index);

    let loadingPrev = false;
    let loadingNew = false;

    // we want to track whether the loading was initiated by a scroll event or not
    let loadingFromScroll = false;

    // treat this as if it might be null so we don't get errors when it's unmounted
    let messagesDiv: HTMLDivElement | undefined;
    let messagesDivHeight: number;
    let initialised = false;
    let scrollingToMessage = false;
    let scrollTimer: number | undefined;
    let currentChatId = "";
    let observer: IntersectionObserver;
    let messageReadTimers: Record<number, number> = {};
    let insideFromBottomThreshold: boolean = true;
    let morePrevAvailable = false;
    let previousScrollHeight: number | undefined = undefined;
    let previousScrollTop: number | undefined = undefined;
    let interrupt = false;

    onMount(() => {
        const options = {
            root: messagesDiv as Element,
            rootMargin: "0px",
            threshold: [0.1, 0.2, 0.3, 0.4, 0.5],
        };

        morePrevAvailable = client.morePreviousMessagesAvailable(chat.chatId);

        observer = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
            entries.forEach((entry) => {
                const idxAttrs = entry.target.attributes.getNamedItem("data-index");
                const idAttr = entry.target.attributes.getNamedItem("data-id");
                const idx = idxAttrs
                    ? idxAttrs.value
                          .split(" ")
                          .map((v) => parseInt(v, 10))
                          .pop()
                    : undefined;
                const id = idAttr ? BigInt(idAttr.value) : undefined;
                if (idx !== undefined) {
                    const intersectionRatioRequired =
                        0 < messagesDivHeight && messagesDivHeight < entry.boundingClientRect.height
                            ? (messagesDivHeight * 0.5) / entry.boundingClientRect.height
                            : 0.5;

                    const isIntersecting = entry.intersectionRatio >= intersectionRatioRequired;
                    if (isIntersecting && messageReadTimers[idx] === undefined) {
                        const chatId = chat.chatId;
                        const timer = window.setTimeout(() => {
                            if (chatId === chat.chatId) {
                                client.markMessageRead(chat.chatId, idx, id);
                                if (id !== undefined) {
                                    client.broadcastMessageRead(chat, id);
                                }
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

        client.addEventListener("openchat_event", clientEvent);

        return () => {
            client.removeEventListener("openchat_event", clientEvent);
        };
    });

    function expandDeletedMessages(ev: CustomEvent<{ scrollTop: number; scrollHeight: number }>) {
        tick().then(() => {
            if (messagesDiv) {
                expectedScrollTop = undefined;
                const diff = (messagesDiv?.scrollHeight ?? 0) - ev.detail.scrollHeight;
                interruptScroll(() => {
                    messagesDiv?.scrollTo({ top: ev.detail.scrollTop - diff, behavior: "auto" });
                });
            }
        });
    }

    function retrySend(ev: CustomEvent<EventWrapper<Message>>): void {
        client.retrySendMessage(chat.chatId, ev.detail, events, undefined);
    }

    function clientEvent(ev: Event): void {
        if (ev instanceof LoadedNewMessages) {
            onLoadedNewMessages(ev.detail);
        }
        if (ev instanceof LoadedPreviousMessages) {
            onLoadedPreviousMessages();
        }
        if (ev instanceof LoadedMessageWindow) {
            onMessageWindowLoaded(ev.detail);
        }
        if (ev instanceof ChatUpdated) {
            loadMoreIfRequired();
        }
        if (ev instanceof SentMessage) {
            afterSendMessage(ev.detail);
        }
    }

    beforeUpdate(() => {
        previousScrollHeight = messagesDiv?.scrollHeight;
        previousScrollTop = messagesDiv?.scrollTop;
    });

    afterUpdate(() => {
        setIfInsideFromBottomThreshold();
        morePrevAvailable = client.morePreviousMessagesAvailable(chat.chatId);
    });

    function scrollBottom(behavior: ScrollBehavior = "auto") {
        interruptScroll(() => {
            messagesDiv?.scrollTo({
                top: 0,
                behavior,
            });
        });
    }

    // this *looks* crazy - but the idea is that before we programmatically scroll the messages div
    // we set the overflow to hidden. This has the effect of immediately halting any momentum scrolling
    // on iOS which prevents the screen going black.
    function interruptScroll(fn: () => void): void {
        interrupt = true;
        fn();
        window.setTimeout(() => (interrupt = false), 10);
    }

    function scrollToElement(element: Element | null, behavior: ScrollBehavior = "auto") {
        interruptScroll(() => {
            element?.scrollIntoView({ behavior, block: "center" });
        });
    }

    function scrollToMention(mention: Mention | undefined) {
        if (mention !== undefined) {
            scrollToMessageIndex(mention.messageIndex, false);
        }
    }

    function findMessageEvent(index: number): EventWrapper<Message> | undefined {
        return events.find(
            (ev) =>
                ev.event.kind === "message" &&
                ev.event.messageIndex === index &&
                !failedMessagesStore.contains(chat.chatId, ev.event.messageId)
        ) as EventWrapper<Message> | undefined;
    }

    export function scrollToMessageIndex(
        index: number,
        preserveFocus: boolean,
        loadWindowIfMissing: boolean = true
    ) {
        if (index < 0) {
            client.setFocusMessageIndex(chat.chatId, undefined);
            return;
        }

        // set a flag so that we can ignore subsequent scroll events temporarily
        scrollingToMessage = true;
        client.setFocusMessageIndex(chat.chatId, index);
        const element = document.querySelector(`.chat-messages [data-index~='${index}']`);
        if (element) {
            // this triggers on scroll which will potentially load some new messages
            scrollToElement(element);
            const msgEvent = findMessageEvent(index);
            if (msgEvent) {
                if (msgEvent.event.thread !== undefined && $pathParams.open) {
                    client.openThread(msgEvent.event.messageId, msgEvent.event.messageIndex, false);
                } else {
                    client.closeThread();
                }
            }
            if (!preserveFocus) {
                setTimeout(() => {
                    client.setFocusMessageIndex(chat.chatId, undefined);
                }, 200);
            }
        } else if (loadWindowIfMissing) {
            client.loadEventWindow(chat.chatId, index);
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
        morePrevAvailable = client.morePreviousMessagesAvailable(chat.chatId);
        return !loadingPrev && calculateFromTop() < MESSAGE_LOAD_THRESHOLD && morePrevAvailable;
    }

    function shouldLoadNewMessages() {
        return (
            !loadingNew &&
            calculateFromBottom() < MESSAGE_LOAD_THRESHOLD &&
            client.moreNewMessagesAvailable(chat.chatId)
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
            interruptScroll(() => {
                messagesDiv?.scrollTo({ top: expectedScrollTop, behavior: "auto" }); // this should trigger another call to onScroll
            });
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

        loadMoreIfRequired(true);

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

    function goToMessageIndex(ev: CustomEvent<{ index: number }>) {
        doGoToMessageIndex(ev.detail.index);
    }

    function doGoToMessageIndex(index: number): void {
        push(`/${chat.chatId}`);
        scrollToMessageIndex(index, false);
    }

    function replyTo(ev: CustomEvent<EnhancedReplyContext>) {
        if (!canSend) return;
        dispatch("replyTo", ev.detail);
    }

    function onEditEvent(ev: CustomEvent<EventWrapper<Message>>) {
        currentChatDraftMessage.setEditing(chat.chatId, ev.detail);
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

    function onMessageWindowLoaded(messageIndex: number | undefined) {
        if (messageIndex === undefined) return;
        tick()
            .then(() => (initialised = true))
            .then(() => {
                expectedScrollTop = undefined;
                scrollToMessageIndex(messageIndex, false, true);
            })
            .then(() => loadMoreIfRequired());
    }

    export function externalGoToMessage(messageIndex: number): void {
        onMessageWindowLoaded(messageIndex);
    }

    function onLoadedPreviousMessages() {
        tick()
            .then(() => (initialised = true))
            .then(resetScroll)
            .then(() => {
                expectedScrollTop = messagesDiv?.scrollTop ?? 0;
            })
            .then(() => (loadingFromScroll = loadingPrev = false))
            .then(() => loadMoreIfRequired());
    }

    function onLoadedNewMessages(newLatestMessage: boolean) {
        tick()
            .then(() => {
                setIfInsideFromBottomThreshold();
                if (
                    loadingFromScroll &&
                    isSafari && // unfortunate
                    insideFromBottomThreshold &&
                    previousScrollHeight !== undefined &&
                    previousScrollTop !== undefined &&
                    messagesDiv !== undefined
                ) {
                    // after loading new content below the viewport, chrome, firefox and edge will automatically maintain scroll position
                    // safari DOES NOT so we need to try to adjust it
                    const clientHeightChange = messagesDiv.scrollHeight - previousScrollHeight;
                    if (clientHeightChange > 0) {
                        // if the height has changed we update the scroll position to whatever it was *before* the render _minus_ the clientHeightChange
                        interruptScroll(() => {
                            if (messagesDiv !== undefined) {
                                messagesDiv.scrollTop =
                                    (previousScrollTop ?? 0) - clientHeightChange;
                                console.log("scrollTop updated to " + messagesDiv.scrollTop);
                            }
                        });
                    }
                } else if (newLatestMessage && insideFromBottomThreshold) {
                    // only scroll if we are now within threshold from the bottom
                    scrollBottom("smooth");
                }
            })
            .then(() => (loadingFromScroll = loadingNew = false))
            .then(() => loadMoreIfRequired());
    }

    // Checks if a key already exists for this group, if so, that key will be reused so that Svelte is able to match the
    // new version with the old version, if not, a new key will be created for the group.
    function userGroupKey(group: EventWrapper<ChatEventType>[]): string {
        const first = group[0];
        let prefix = "";
        if (first.event.kind === "message") {
            const sender = first.event.sender;
            prefix = sender + "_";
        }
        for (const evt of group) {
            const key = prefix + (evt.event.kind === "message" ? evt.event.messageId : evt.index);
            if ($userGroupKeys.has(key)) {
                return key;
            }
        }
        const firstKey =
            prefix + (first.event.kind === "message" ? first.event.messageId : first.index);
        chatStateStore.updateProp(chat.chatId, "userGroupKeys", (keys) => {
            keys.add(firstKey);
            return keys;
        });
        return firstKey;
    }

    $: expandedDeletedMessages = client.expandedDeletedMessages;

    $: groupedEvents = client
        .groupEvents(events, user.userId, $expandedDeletedMessages, groupInner(filteredProposals))
        .reverse();

    $: {
        if (chat.chatId !== currentChatId) {
            currentChatId = chat.chatId;
            initialised = false;

            // If the chat is empty, there is nothing to initialise, so we can set initialised to true
            const isEmptyChat = chat.latestEventIndex < 0;
            if (isEmptyChat) {
                initialised = true;
            }
        }
    }

    function setIfInsideFromBottomThreshold() {
        insideFromBottomThreshold = calculateFromBottom() < FROM_BOTTOM_THRESHOLD;
    }

    function isMe(evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message") {
            return evt.event.sender === user.userId;
        }
        if (evt.event.kind === "group_chat_created") {
            return evt.event.created_by === user.userId;
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
    function loadMoreIfRequired(fromScroll = false) {
        if (shouldLoadNewMessages()) {
            loadingNew = true;
            loadingFromScroll = fromScroll;
            client.loadNewMessages(chat.chatId);
        }
        if (shouldLoadPreviousMessages()) {
            loadingPrev = true;
            loadingFromScroll = fromScroll;
            client.loadPreviousMessages(chat.chatId);
        }
    }

    function isConfirmed(evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message") {
            return !unconfirmed.contains(chat.chatId, evt.event.messageId);
        }
        return true;
    }

    function isFailed(_failed: FailedMessages, evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message") {
            return failedMessagesStore.contains(chat.chatId, evt.event.messageId);
        }
        return false;
    }

    function isReadByThem(
        chat: ChatSummary,
        readByThem: Set<bigint>,
        evt: EventWrapper<ChatEventType>
    ): boolean {
        if (evt.event.kind === "message") {
            const confirmedRead = client.messageIsReadByThem(chat.chatId, evt.event.messageIndex);
            if (confirmedRead && readByThem.has(evt.event.messageId)) {
                unconfirmedReadByThem.delete(evt.event.messageId);
            }
            return confirmedRead || readByThem.has(evt.event.messageId);
        }
        return true;
    }

    function isReadByMe(_store: MessageReadState, evt: EventWrapper<ChatEventType>): boolean {
        if (readonly) return true;

        if (evt.event.kind === "message" || evt.event.kind === "aggregate_common_events") {
            let messageIndex =
                evt.event.kind === "message"
                    ? evt.event.messageIndex
                    : evt.event.messagesDeleted[evt.event.messagesDeleted.length - 1];
            let messageId = evt.event.kind === "message" ? evt.event.messageId : undefined;
            const isRead = client.isMessageRead(chat.chatId, messageIndex, messageId);
            if (!isRead && evt.event.kind === "message" && evt.event.sender === user.userId) {
                client.markMessageRead(chat.chatId, messageIndex, messageId);
                return true;
            }
            return isRead;
        }
        return true;
    }

    function isPinned(store: Set<number>, evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message") {
            return store.has(evt.event.messageIndex);
        }

        return false;
    }

    function isCollapsed(
        ew: EventWrapper<ChatEventType>,
        filteredProposals: FilteredProposals | undefined
    ): boolean {
        return ew.event.kind === "message" && isCollpasedProposal(ew.event, filteredProposals);
    }

    function toggleMessageExpansion(ew: EventWrapper<ChatEventType>, expand: boolean) {
        if (ew.event.kind === "message" && ew.event.content.kind === "proposal_content") {
            client.toggleProposalFilterMessageExpansion(ew.event.messageId, expand);
        }
    }

    function groupInner(filteredProposals: FilteredProposals | undefined) {
        return (events: EventWrapper<ChatEventType>[]) => {
            return client.groupWhile((a, b) => inSameGroup(a, b, filteredProposals), events);
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
                return client.sameUser(a, b);
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

    function afterSendMessage(upToDate: boolean) {
        if (upToDate && calculateFromBottom() < FROM_BOTTOM_THRESHOLD) {
            tick().then(() => scrollBottom("smooth"));
        }
    }

    function shouldShowAvatar(
        chat: ChatSummary,
        earliestLoadedEventIndex: number | undefined
    ): boolean {
        // If this is an empty chat, show the avatar
        const isEmptyChat = chat.latestEventIndex < 0;
        if (isEmptyChat) {
            return true;
        }
        // Otherwise, only show the avatar if we have loaded right back to the earliest available events
        if (earliestLoadedEventIndex === undefined) {
            return false;
        }
        // For new direct chats the first event is the 'DirectChatCreated' event which we only load a short while after
        // sending the first message, so to prevent a short flicker with no avatar, we still show the avatar if the
        // earliest loaded event index is 1, even though event 0 is available
        const indexRequired = Math.max(client.earliestAvailableEventIndex(chat), 1);
        return earliestLoadedEventIndex <= indexRequired;
    }
</script>

<div
    bind:this={messagesDiv}
    bind:clientHeight={messagesDivHeight}
    class="chat-messages"
    class:interrupt
    on:scroll={onScroll}
    id="chat-messages">
    {#each groupedEvents as dayGroup, _di (dateGroupKey(dayGroup))}
        <div class="day-group">
            <div class="date-label">
                {client.formatMessageDate(dayGroup[0][0]?.timestamp, $_("today"), $_("yesterday"))}
            </div>
            {#each dayGroup as innerGroup, _ui (userGroupKey(innerGroup))}
                {#each innerGroup as evt, i (eventKey(evt))}
                    <ChatEvent
                        {observer}
                        focused={evt.event.kind === "message" &&
                            evt.event.messageIndex === $focusMessageIndex &&
                            !isFailed($failedMessagesStore, evt)}
                        confirmed={isConfirmed(evt)}
                        failed={isFailed($failedMessagesStore, evt)}
                        readByThem={isReadByThem(chat, $unconfirmedReadByThem, evt)}
                        readByMe={isReadByMe($messagesRead, evt)}
                        chatId={chat.chatId}
                        chatType={chat.kind}
                        {user}
                        me={isMe(evt)}
                        first={i === 0}
                        last={i + 1 === innerGroup.length}
                        {readonly}
                        {canPin}
                        {canBlockUser}
                        {canDelete}
                        {canSend}
                        {canReact}
                        {canInvite}
                        {canReplyInThread}
                        collapsed={isCollapsed(evt, filteredProposals)}
                        supportsEdit={true}
                        supportsReply={true}
                        threadRootMessage={undefined}
                        publicGroup={chat.kind === "group_chat" && chat.public}
                        pinned={isPinned($currentChatPinnedMessages, evt)}
                        editing={$currentChatEditingEvent === evt}
                        on:chatWith
                        on:replyTo={replyTo}
                        on:replyPrivatelyTo
                        on:editEvent={onEditEvent}
                        on:goToMessageIndex={goToMessageIndex}
                        on:expandMessage={() => toggleMessageExpansion(evt, true)}
                        on:collapseMessage={() => toggleMessageExpansion(evt, false)}
                        on:upgrade
                        on:forward
                        on:retrySend={retrySend}
                        on:expandDeletedMessages={expandDeletedMessages}
                        event={evt} />
                {/each}
            {/each}
        </div>
    {/each}
    {#if showAvatar}
        {#if $isProposalGroup}
            <ProposalBot />
        {:else if chat.kind === "group_chat"}
            <InitialGroupMessage group={chat} noVisibleEvents={events.length === 0} />
        {:else if client.isOpenChatBot(chat.them)}
            <Robot />
        {:else}
            <div class="big-avatar">
                <Avatar
                    url={client.userAvatarUrl($userStore[chat.them])}
                    userId={chat.them}
                    size={AvatarSize.Large} />
            </div>
        {/if}
    {/if}
</div>
{#if !readonly}
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
    title={$_("goToLatestMessage")}
    class:show={!insideFromBottomThreshold || unreadMessages > 0}
    class="fab to-bottom"
    class:footer
    class:rtl={$rtlStore}>
    <Fab on:click={() => scrollToMessageIndex(chat.latestMessage?.event.messageIndex ?? -1, false)}>
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
        @include message-list();
        background-color: var(--currentChat-msgs-bg);

        &.interrupt {
            overflow-y: hidden;
        }
    }

    .big-avatar {
        margin: 16px auto;
    }
</style>
