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
    import ChatEvent from "./ChatEvent.svelte";
    import Robot from "../Robot.svelte";
    import ProposalBot from "../ProposalBot.svelte";
    import { _ } from "svelte-i18n";
    import ArrowDown from "svelte-material-icons/ArrowDown.svelte";
    import Fab from "../Fab.svelte";
    import { rtlStore } from "../../stores/rtl";
    import {
        EventWrapper,
        EnhancedReplyContext,
        ChatEvent as ChatEventType,
        Message,
        Mention,
        ChatSummary,
        MessageContent,
        OpenChat,
        FilteredProposals,
        WebRtcMessage,
        MessageReadState,
        User,
        RemoteUserToggledReaction,
        RemoteUserSentMessage,
        LoadedNewMessages,
        MessageSentByOther,
        ChatUpdated,
        LoadedMessageWindow,
        LoadedPreviousMessages,
        SentMessage,
        UpgradeRequired,
    } from "openchat-client";
    import { pop } from "../../utils/transition";
    import { menuStore } from "../../stores/menu";
    import { tooltipStore } from "../../stores/tooltip";
    import { iconSize } from "../../stores/iconSize";
    import InitialGroupMessage from "./InitialGroupMessage.svelte";
    import { RelayedEvent, relaySubscribe, relayUnsubscribe } from "../../stores/relay";
    import { pathParams } from "../../stores/routing";
    import { push } from "svelte-spa-router";
    import { copyMessageUrl, shareMessage } from "../../utils/share";

    // todo - these thresholds need to be relative to screen height otherwise things get screwed up on (relatively) tall screens
    const MESSAGE_LOAD_THRESHOLD = 400;
    const FROM_BOTTOM_THRESHOLD = 600;
    const MESSAGE_READ_THRESHOLD = 500;

    const client = getContext<OpenChat>("client");
    const user = client.user;
    const dispatch = createEventDispatcher();

    export let chat: ChatSummary;
    export let serverChat: ChatSummary;
    export let unreadMessages: number;
    export let preview: boolean;
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
    $: typing = client.typing;
    $: localMessageUpdates = client.localMessageUpdates;
    $: currentChatReplyingTo = client.currentChatReplyingTo;
    $: remainingStorage = client.remainingStorage;
    $: unconfirmedReadByThem = client.unconfirmedReadByThem;
    $: unconfirmed = client.unconfirmed;
    $: userGroupKeys = client.userGroupKeys;
    $: currentChatDraftMessage = client.currentChatDraftMessage;
    $: focusMessageIndex = client.focusMessageIndex;
    $: chatStateStore = client.chatStateStore;
    $: currentChatUserIds = client.currentChatUserIds;
    $: userStore = client.userStore;
    $: isBot = chat.kind === "direct_chat" && $userStore[chat.them]?.kind === "bot";

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
    let morePrevAvailable = false;
    let previousScrollHeight: number | undefined = undefined;

    onMount(() => {
        const options = {
            root: messagesDiv as Element,
            rootMargin: "0px",
            threshold: [0.1, 0.2, 0.3, 0.4, 0.5],
        };

        morePrevAvailable = client.morePreviousMessagesAvailable(chat);

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
                        const chatId = chat.chatId;
                        const timer = window.setTimeout(() => {
                            if (chatId === chat.chatId) {
                                client.markMessageRead(chat.chatId, idx, id);

                                if (chat.kind === "direct_chat") {
                                    const rtc: WebRtcMessage = {
                                        kind: "remote_user_read_message",
                                        chatType: chat.kind,
                                        messageId: id,
                                        chatId: chat.chatId,
                                        userId: user.userId,
                                    };
                                    client.sendRtcMessage([...$currentChatUserIds], rtc);
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

        // this is where we pick up events that may be published from a thread
        relaySubscribe((event: RelayedEvent) => {
            if (event.kind === "relayed_delete_message") {
                doDeleteMessage(event.message);
            }

            if (event.kind === "relayed_goto_message") {
                doGoToMessageIndex(event.index);
            }

            if (event.kind === "relayed_select_reaction") {
                onSelectReaction(event);
            }

            if (event.kind === "relayed_register_vote") {
                client.registerPollVote(
                    chat.chatId,
                    undefined,
                    event.data.messageId,
                    event.data.messageIndex,
                    event.data.answerIndex,
                    event.data.type
                );
            }
        });

        client.addEventListener("openchat_event", clientEvent);

        return () => {
            client.removeEventListener("openchat_event", clientEvent);
            relayUnsubscribe();
        };
    });

    function clientEvent(ev: Event): void {
        if (ev instanceof LoadedNewMessages) {
            onLoadedNewMessages(ev.detail);
        }
        if (ev instanceof MessageSentByOther) {
            onLoadedNewMessages(true);
        }
        if (ev instanceof LoadedPreviousMessages) {
            onLoadedPreviousMessages();
        }
        if (ev instanceof LoadedMessageWindow) {
            onMessageWindowLoaded(ev.detail);
        }
        if (ev instanceof ChatUpdated) {
            chatUpdated();
        }
        if (ev instanceof SentMessage) {
            afterSendMessage(ev.detail);
        }
        if (ev instanceof UpgradeRequired) {
            dispatch("upgrade", ev.detail);
        }
        console.log("openchat_event received: ", ev);
    }

    beforeUpdate(() => (previousScrollHeight = messagesDiv?.scrollHeight));

    afterUpdate(() => {
        setIfInsideFromBottomThreshold();
        morePrevAvailable = client.morePreviousMessagesAvailable(chat);
    });

    function scrollBottom(behavior: ScrollBehavior = "auto") {
        messagesDiv?.scrollTo({
            top: 0,
            behavior,
        });
    }

    function scrollToElement(element: Element | null, behavior: ScrollBehavior = "auto") {
        element?.scrollIntoView({ behavior, block: "center" });
    }

    function scrollToMention(mention: Mention | undefined) {
        if (mention !== undefined) {
            scrollToMessageIndex(mention.messageIndex, false);
        }
    }

    function findMessageEvent(index: number): EventWrapper<Message> | undefined {
        return events.find(
            (ev) => ev.event.kind === "message" && ev.event.messageIndex === index
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
        const element = document.querySelector(`[data-index='${index}']`);
        if (element) {
            // this triggers on scroll which will potentially load some new messages
            scrollToElement(element);
            const msgEvent = findMessageEvent(index);
            if (msgEvent) {
                if (msgEvent.event.thread !== undefined && $pathParams.open) {
                    dispatch("openThread", {
                        rootEvent: msgEvent,
                    });
                } else {
                    dispatch("closeThread");
                }
            }
            if (!preserveFocus) {
                setTimeout(() => {
                    client.setFocusMessageIndex(chat.chatId, undefined);
                }, 200);
            }
        } else if (loadWindowIfMissing) {
            client.loadEventWindow(serverChat, chat, index);
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
        morePrevAvailable = client.morePreviousMessagesAvailable(chat);
        return !loadingPrev && calculateFromTop() < MESSAGE_LOAD_THRESHOLD && morePrevAvailable;
    }

    function shouldLoadNewMessages() {
        return (
            !loadingNew &&
            calculateFromBottom() < MESSAGE_LOAD_THRESHOLD &&
            client.moreNewMessagesAvailable(serverChat)
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
            client.loadPreviousMessages(serverChat, chat);
        }

        if (shouldLoadNewMessages()) {
            // Note - this fires even when we have entered our own message. This *seems* wrong but
            // it is actually correct because we do want to load our own messages from the server
            // so that any incorrect indexes are corrected and only the right thing goes in the cache
            loadingNew = true;
            client.loadNewMessages(serverChat, chat);
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

        const kind = client.containsReaction(user.userId, reaction, message.reactions)
            ? "remove"
            : "add";

        client
            .selectReaction(
                chat,
                user.userId,
                undefined,
                message.messageId,
                reaction,
                user.username,
                kind
            )
            .then((success) => {
                if (success && kind === "add") {
                    client.trackEvent("reacted_to_message");
                }
            });

        client.sendRtcMessage([...$currentChatUserIds], {
            kind: "remote_user_toggled_reaction",
            chatType: chat.kind,
            chatId: chat.chatId,
            messageId: message.messageId,
            reaction,
            userId: user.userId,
            added: kind === "add",
        });
    }

    function onSelectReactionEv(ev: CustomEvent<{ message: Message; reaction: string }>) {
        onSelectReaction(ev.detail);
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

    function onDeleteMessage(ev: CustomEvent<Message>) {
        doDeleteMessage(ev.detail);
    }

    function doDeleteMessage(message: Message) {
        if (!canDelete && user.userId !== message.sender) return;

        client.deleteMessage(chat, undefined, message.messageId);
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

    function onBlockUser(ev: CustomEvent<{ userId: string }>) {
        if (!canBlockUser) return;
        client.blockUser(chat.chatId, ev.detail.userId);
    }

    function onMessageWindowLoaded(messageIndex: number | undefined) {
        if (messageIndex === undefined) return;
        tick()
            .then(() => (initialised = true))
            .then(() => {
                expectedScrollTop = undefined;
                scrollToMessageIndex(messageIndex, false, true);
            })
            .then(loadMoreIfRequired);
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
            .then(() => (loadingPrev = false))
            .then(loadMoreIfRequired);
    }

    function onLoadedNewMessages(newLatestMessage: boolean) {
        tick()
            .then(() => {
                setIfInsideFromBottomThreshold();
                if (newLatestMessage && insideFromBottomThreshold) {
                    // only scroll if we are now within threshold from the bottom
                    scrollBottom("smooth");
                } else if (messagesDiv?.scrollTop === 0 && previousScrollHeight !== undefined) {
                    const clientHeightChange = messagesDiv.scrollHeight - previousScrollHeight;
                    if (clientHeightChange > 0) {
                        messagesDiv.scrollTop = -clientHeightChange;
                        console.log("scrollTop updated from 0 to " + messagesDiv.scrollTop);
                    }
                }
            })
            .then(() => (loadingNew = false))
            .then(loadMoreIfRequired);
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
        for (const { index } of group) {
            const key = prefix + index;
            if ($userGroupKeys.has(key)) {
                return key;
            }
        }
        const firstKey = prefix + first.index;
        chatStateStore.updateProp(chat.chatId, "userGroupKeys", (keys) => {
            keys.add(firstKey);
            return keys;
        });
        return firstKey;
    }

    function chatUpdated(): void {
        if (insideFromBottomThreshold && shouldLoadNewMessages()) {
            client.loadNewMessages(serverChat, chat);
        }
    }

    $: groupedEvents = client.groupEvents(events, groupInner(filteredProposals)).reverse();

    $: {
        if (chat.chatId !== currentChatId) {
            currentChatId = chat.chatId;
            initialised = false;

            if ($focusMessageIndex !== undefined) {
                client.loadEventWindow(serverChat, chat, $focusMessageIndex).then(() => {
                    client.loadDetails(chat, events);
                });
            } else {
                client.loadPreviousMessages(serverChat, chat).then(() => {
                    client.loadDetails(chat, events);
                });
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
    function loadMoreIfRequired() {
        if (shouldLoadNewMessages()) {
            loadingNew = true;
            client.loadNewMessages(serverChat, chat);
        }
        if (shouldLoadPreviousMessages()) {
            loadingPrev = true;
            client.loadPreviousMessages(serverChat, chat);
        }
    }

    function isConfirmed(evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message") {
            return !unconfirmed.contains(chat.chatId, evt.event.messageId);
        }
        return true;
    }

    function isReadByThem(
        chat: ChatSummary,
        readByThem: Set<bigint>,
        evt: EventWrapper<ChatEventType>
    ): boolean {
        if (evt.event.kind === "message") {
            const confirmedRead = client.messageIsReadByThem(chat, evt.event);
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
            const isRead = client.isMessageRead(
                chat.chatId,
                evt.event.messageIndex,
                evt.event.messageId
            );
            if (!isRead && evt.event.sender === user.userId) {
                client.markMessageRead(chat.chatId, evt.event.messageIndex, evt.event.messageId);
                return true;
            }
            return isRead;
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

    function onPinMessage(ev: CustomEvent<Message>) {
        if (!canPin) return;
        client.pinMessage(chat, ev.detail.messageIndex);
    }

    function onUnpinMessage(ev: CustomEvent<Message>) {
        if (!canPin) return;
        client.unpinMessage(chat, ev.detail.messageIndex);
    }

    function registerVote(
        ev: CustomEvent<{
            messageId: bigint;
            messageIndex: number;
            answerIndex: number;
            type: "register" | "delete";
        }>
    ) {
        client.registerPollVote(
            chat.chatId,
            undefined,
            ev.detail.messageId,
            ev.detail.messageIndex,
            ev.detail.answerIndex,
            ev.detail.type
        );
    }

    function onShareMessage(ev: CustomEvent<Message>) {
        shareMessage($_, user.userId, ev.detail.sender === user.userId, ev.detail);
    }

    function onCopyMessageUrl(ev: CustomEvent<Message>) {
        copyMessageUrl(chat.chatId, ev.detail.messageIndex);
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

    function afterSendMessage(jumpingTo: number | undefined) {
        if (jumpingTo !== undefined && jumpingTo !== null) {
            onMessageWindowLoaded(jumpingTo);
        } else {
            tick().then(() => scrollBottom("smooth"));
        }
    }

    function remoteUserSentMessage(message: RemoteUserSentMessage): void {
        const existing = client.findMessageById(message.messageEvent.event.messageId, events);
        if (existing !== undefined) {
            return;
        }

        // We should overwrite the event index and message index to ensure these new messages always get placed at the
        // end rather than before any unconfirmed messages we have sent. Also, for direct chats the indexes can mismatch
        // due to either user being blocked temporarily, so by overwriting the indexes we avoid issues caused by this.
        const [eventIndex, messageIndex] = client.nextEventAndMessageIndexes();
        unconfirmed.add(chat.chatId, {
            ...message.messageEvent,
            index: eventIndex,
            event: {
                ...message.messageEvent.event,
                messageIndex,
            },
        });
    }

    export function handleWebRtcMessage(fromChatId: string, msg: WebRtcMessage): void {
        switch (msg.kind) {
            case "remote_user_typing":
                typing.startTyping(fromChatId, msg.userId, msg.threadRootMessageIndex);
                break;
            case "remote_user_stopped_typing":
                typing.stopTyping(msg.userId);
                break;
            case "remote_user_toggled_reaction":
                client.remoteUserToggledReaction(events, msg);
                break;
            case "remote_user_deleted_message":
                localMessageUpdates.markDeleted(msg.messageId.toString(), msg.userId);
                break;
            case "remote_user_removed_message":
                client.removeMessage(user.userId, chat, msg.messageId, msg.userId);
                break;
            case "remote_user_undeleted_message":
                localMessageUpdates.markUndeleted(msg.messageId.toString());
                break;
            case "remote_user_sent_message":
                remoteUserSentMessage(msg);
                break;
            case "remote_user_read_message":
                unconfirmedReadByThem.add(BigInt(msg.messageId));
                break;
        }
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
                {client.formatMessageDate(dayGroup[0][0]?.timestamp, $_("today"), $_("yesterday"))}
            </div>
            {#each dayGroup as innerGroup, _ui (userGroupKey(innerGroup))}
                {#each innerGroup as evt, i (eventKey(evt))}
                    <ChatEvent
                        {observer}
                        focused={evt.event.kind === "message" &&
                            evt.event.messageIndex === $focusMessageIndex}
                        confirmed={isConfirmed(evt)}
                        readByThem={isReadByThem(chat, $unconfirmedReadByThem, evt)}
                        readByMe={isReadByMe($messagesRead, evt)}
                        chatId={chat.chatId}
                        chatType={chat.kind}
                        {user}
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
                        collapsed={isCollapsed(evt, filteredProposals)}
                        supportsEdit={true}
                        supportsReply={true}
                        inThread={false}
                        publicGroup={chat.kind === "group_chat" && chat.public}
                        pinned={isPinned($currentChatPinnedMessages, evt)}
                        editing={$currentChatEditingEvent === evt}
                        on:chatWith
                        on:initiateThread
                        on:replyTo={replyTo}
                        on:replyPrivatelyTo
                        on:deleteMessage={onDeleteMessage}
                        on:editEvent={onEditEvent}
                        on:goToMessageIndex={goToMessageIndex}
                        on:selectReaction={onSelectReactionEv}
                        on:blockUser={onBlockUser}
                        on:pinMessage={onPinMessage}
                        on:unpinMessage={onUnpinMessage}
                        on:registerVote={registerVote}
                        on:copyMessageUrl={onCopyMessageUrl}
                        on:shareMessage={onShareMessage}
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
        {:else if chat.kind === "group_chat"}
            <InitialGroupMessage group={chat} noVisibleEvents={events.length === 0} />
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
