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
    import { formatMessageDate } from "../../utils/date";
    import DRange from "drange";
    import type {
        EventWrapper,
        EnhancedReplyContext,
        ChatEvent as ChatEventType,
        Message,
        Mention,
        ChatSummary,
        EventsResponse,
        EventsSuccessResult,
        MessageContent,
        SendMessageSuccess,
        TransferSuccess,
    } from "../../domain/chat/chat";
    import { remainingStorage } from "../../stores/storage";
    import {
        canForward,
        containsReaction,
        createMessage,
        getStorageRequiredForMessage,
        groupEvents,
        indexRangeForChat,
        makeRtcConnections,
        mergeSendMessageResponse,
        messageIsReadByThem,
        newMessageId,
        replaceAffected,
        replaceLocal,
        sameUser,
        serialiseMessageForRtc,
        upToDate,
        userIdsFromEvents,
    } from "../../domain/chat/chat.utils";
    import { pop } from "../../utils/transition";
    import { unconfirmed, unconfirmedReadByThem } from "../../stores/unconfirmed";
    import {
        blockUser,
        deleteMessage,
        findMessageEvent,
        pinMessage,
        registerPollVote,
        removeMessage,
        selectReaction,
        unpinMessage,
        updateUserStore,
        appendMessage,
    } from "../../fsm/chat.controller";
    import { MessageReadState, messagesRead } from "../../stores/markRead";
    import { menuStore } from "../../stores/menu";
    import { tooltipStore } from "../../stores/tooltip";
    import { iconSize } from "../../stores/iconSize";
    import InitialGroupMessage from "./InitialGroupMessage.svelte";
    import { currentUserKey, userStore } from "../../stores/user";
    import { RelayedEvent, relaySubscribe, relayUnsubscribe } from "../../stores/relay";
    import { trackEvent } from "../../utils/tracking";
    import * as shareFunctions from "../../domain/share";
    import {
        currentChatBlockedUsers,
        currentChatDraftMessage,
        currentChatMembers,
        isProposalGroup,
        currentChatUserIds,
        serverEventsStore,
        groupDetails,
        eventsStore,
        focusMessageIndex,
        currentChatPinnedMessages,
        currentChatEditingEvent,
        updateSummaryWithConfirmedMessage,
        nextEventIndex,
        nextMessageIndex,
        currentChatReplyingTo,
        chatUpdatedStore,
    } from "../../stores/chat";
    import {
        FilteredProposals,
        toggleProposalFilterMessageExpansion,
        filteredProposalsStore,
    } from "../../stores/filteredProposals";
    import { findLast, groupWhile } from "../../utils/list";
    import { pathParams } from "../../stores/routing";
    import { apiKey, ServiceContainer } from "../../services/serviceContainer";
    import type { CreatedUser, User } from "../../domain/user/user";
    import { rollbar } from "utils/logging";
    import { toastStore } from "stores/toast";
    import { rtcConnectionsManager } from "domain/webrtc/RtcConnectionsManager";
    import { indexIsInRanges } from "utils/range";

    // todo - these thresholds need to be relative to screen height otherwise things get screwed up on (relatively) tall screens
    const MESSAGE_LOAD_THRESHOLD = 400;
    const FROM_BOTTOM_THRESHOLD = 600;
    const MESSAGE_READ_THRESHOLD = 500;

    const dispatch = createEventDispatcher();
    const api = getContext<ServiceContainer>(apiKey);
    const user = getContext<CreatedUser>(currentUserKey);

    export let chat: ChatSummary;
    export let serverChat: ChatSummary;
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
    let confirmedEventIndexesLoaded = new DRange();
    let userGroupKeys = new Set<string>();

    onMount(() => {
        const options = {
            root: messagesDiv as Element,
            rootMargin: "0px",
            threshold: [0.1, 0.2, 0.3, 0.4, 0.5],
        };

        morePrevAvailable = morePreviousMessagesAvailable();

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
                doDeleteMessage(event.message);
            }

            if (event.kind === "relayed_select_reaction") {
                onSelectReaction(event);
            }

            if (event.kind === "relayed_register_vote") {
                registerPollVote(
                    api,
                    user.userId,
                    chat.chatId,
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
        morePrevAvailable = morePreviousMessagesAvailable();
    });

    function scrollBottom(behavior: ScrollBehavior = "auto") {
        messagesDiv?.scrollTo({
            top: 0,
            behavior,
        });
    }

    function scrollToNew() {
        const idx = firstUnreadMessage ?? chat.latestMessage?.event.messageIndex;

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
            focusMessageIndex.set(chat.chatId, undefined);
            return;
        }

        // set a flag so that we can ignore subsequent scroll events temporarily
        scrollingToMessage = true;
        focusMessageIndex.set(chat.chatId, index);
        const element = document.querySelector(`[data-index='${index}']`);
        if (element) {
            // this triggers on scroll which will potentially load some new messages
            scrollToElement(element);
            const msgEvent = findMessageEvent($eventsStore, index);
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
                    focusMessageIndex.set(chat.chatId, undefined);
                }, 200);
            }
        } else if (loadWindowIfMissing) {
            loadEventWindow(index, preserveFocus);
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

    function morePreviousMessagesAvailable(): boolean {
        return (earliestLoadedIndex() ?? Number.MAX_VALUE) > earliestAvailableEventIndex();
    }

    function moreNewMessagesAvailable(): boolean {
        return confirmedUpToEventIndex() < latestServerEventIndex();
    }

    function confirmedUpToEventIndex(): number {
        const ranges = confirmedEventIndexesLoaded.subranges();
        if (ranges.length > 0) {
            return ranges[0].high;
        }
        return -1;
    }

    function shouldLoadPreviousMessages() {
        morePrevAvailable = morePreviousMessagesAvailable();
        return !loadingPrev && calculateFromTop() < MESSAGE_LOAD_THRESHOLD && morePrevAvailable;
    }

    function shouldLoadNewMessages() {
        return (
            !loadingNew &&
            calculateFromBottom() < MESSAGE_LOAD_THRESHOLD &&
            moreNewMessagesAvailable()
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
            loadPreviousMessages();
        }

        if (shouldLoadNewMessages()) {
            // Note - this fires even when we have entered our own message. This *seems* wrong but
            // it is actually correct because we do want to load our own messages from the server
            // so that any incorrect indexes are corrected and only the right thing goes in the cache
            loadingNew = true;
            loadNewMessages();
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

        const kind = containsReaction(user.userId, reaction, message.reactions) ? "remove" : "add";

        selectReaction(api, chat, user.userId, undefined, message.messageId, reaction, kind).then(
            (success) => {
                if (success && kind === "add") {
                    trackEvent("reacted_to_message");
                }
            }
        );
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

    function onEditEvent(ev: CustomEvent<EventWrapper<Message>>) {
        currentChatDraftMessage.setEditing(chat.chatId, ev.detail);
    }

    function onDeleteMessage(ev: CustomEvent<Message>) {
        doDeleteMessage(ev.detail);
    }

    function doDeleteMessage(message: Message) {
        if (!canDelete && user.userId !== message.sender) return;

        deleteMessage(api, chat, user.userId, undefined, message.messageId);
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
        blockUser(api, chat.chatId, ev.detail.userId);
    }

    function onMessageWindowLoaded(messageIndex: number) {
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

    async function loadEventWindow(messageIndex: number, preserveFocus = false) {
        if (messageIndex >= 0) {
            const range = indexRangeForChat(serverChat);
            const eventsPromise: Promise<EventsResponse<ChatEventType>> =
                chat.kind === "direct_chat"
                    ? api.directChatEventsWindow(
                          range,
                          chat.them,
                          messageIndex,
                          chat.latestEventIndex
                      )
                    : api.groupChatEventsWindow(
                          range,
                          chat.chatId,
                          messageIndex,
                          chat.latestEventIndex
                      );
            const eventsResponse = await eventsPromise;

            if (eventsResponse === undefined || eventsResponse === "events_failed") {
                return undefined;
            }

            await handleEventsResponse(eventsResponse, false);

            onMessageWindowLoaded(messageIndex);
        }
    }

    async function handleEventsResponse(
        resp: EventsResponse<ChatEventType>,
        keepCurrentEvents = true
    ): Promise<void> {
        if (resp === "events_failed") return;

        if (!keepCurrentEvents) {
            confirmedEventIndexesLoaded = new DRange();
            userGroupKeys = new Set<string>();
        } else if (!isContiguous(resp)) {
            return;
        }

        const updated = replaceAffected(
            replaceLocal(
                user.userId,
                chat.chatId,
                chat.readByMe,
                keepCurrentEvents ? $eventsStore : [],
                resp.events
            ),
            resp.affectedEvents
        );

        const userIds = userIdsFromEvents(updated);
        await updateUserStore(api, chat.chatId, user.userId, userIds);

        serverEventsStore.set(chat.chatId, updated);

        if (resp.events.length > 0) {
            resp.events.forEach((e) => confirmedEventIndexesLoaded.add(e.index));
        }

        makeRtcConnections(user.userId, chat, updated, $userStore);
    }

    function isContiguous(response: EventsSuccessResult<ChatEventType>): boolean {
        if (confirmedEventIndexesLoaded.length === 0 || response.events.length === 0) return true;

        const firstIndex = response.events[0].index;
        const lastIndex = response.events[response.events.length - 1].index;
        const contiguousCheck = new DRange(firstIndex - 1, lastIndex + 1);

        const isContiguous =
            confirmedEventIndexesLoaded.clone().intersect(contiguousCheck).length > 0;

        if (!isContiguous) {
            console.log(
                "Events in response are not contiguous with the loaded events",
                confirmedEventIndexesLoaded,
                firstIndex,
                lastIndex
            );
        }

        return isContiguous;
    }

    function earliestLoadedIndex(): number | undefined {
        return confirmedEventIndexesLoaded.length > 0
            ? confirmedEventIndexesLoaded.index(0)
            : undefined;
    }

    function latestServerEventIndex(): number {
        return serverChat.latestEventIndex;
    }

    function earliestAvailableEventIndex(): number {
        return chat.kind === "group_chat" ? chat.minVisibleEventIndex : 0;
    }

    function previousMessagesCriteria(): [number, boolean] | undefined {
        const minLoadedEventIndex = earliestLoadedIndex();
        if (minLoadedEventIndex === undefined) {
            return [latestServerEventIndex(), false];
        }
        const minVisibleEventIndex = earliestAvailableEventIndex();
        return minLoadedEventIndex !== undefined && minLoadedEventIndex > minVisibleEventIndex
            ? [minLoadedEventIndex - 1, false]
            : undefined;
    }

    function loadEvents(
        startIndex: number,
        ascending: boolean
    ): Promise<EventsResponse<ChatEventType>> {
        return api.chatEvents(
            chat,
            indexRangeForChat(serverChat),
            startIndex,
            ascending,
            undefined,
            chat.latestEventIndex
        );
    }

    async function loadPreviousMessages(): Promise<void> {
        const criteria = previousMessagesCriteria();

        const eventsResponse = criteria ? await loadEvents(criteria[0], criteria[1]) : undefined;

        if (eventsResponse === undefined || eventsResponse === "events_failed") {
            return;
        }

        await handleEventsResponse(eventsResponse);

        onLoadedPreviousMessages();

        return;
    }

    async function loadNewMessages(): Promise<void> {
        const criteria = newMessageCriteria();

        const eventsResponse = criteria ? await loadEvents(criteria[0], criteria[1]) : undefined;

        if (eventsResponse === undefined || eventsResponse === "events_failed") {
            return undefined;
        }

        await handleEventsResponse(eventsResponse);

        // We may have loaded messages which are more recent than what the chat summary thinks is the latest message,
        // if so, we update the chat summary to show the correct latest message.
        const latestMessage = findLast(eventsResponse.events, (e) => e.event.kind === "message");
        const newLatestMessage =
            latestMessage !== undefined && latestMessage.index > latestServerEventIndex();

        if (newLatestMessage) {
            updateSummaryWithConfirmedMessage(chat.chatId, latestMessage as EventWrapper<Message>);
        }

        onLoadedNewMessages(newLatestMessage);
    }

    function newMessageCriteria(): [number, boolean] | undefined {
        const maxServerEventIndex = latestServerEventIndex();
        const loadedUpTo = confirmedUpToEventIndex();

        return loadedUpTo < maxServerEventIndex ? [loadedUpTo + 1, true] : undefined;
    }

    async function loadDetails(): Promise<void> {
        // currently this is only meaningful for group chats, but we'll set it up generically just in case
        if (chat.kind === "group_chat") {
            if ($groupDetails === undefined) {
                const resp = await api.getGroupDetails(chat.chatId, chat.latestEventIndex);
                if (resp !== "caller_not_in_group") {
                    groupDetails.set(chat.chatId, resp);
                    currentChatMembers.set(chat.chatId, resp.members);
                    currentChatBlockedUsers.set(chat.chatId, resp.blockedUsers);
                    currentChatPinnedMessages.set(chat.chatId, resp.pinnedMessages);
                }
                await updateUserStore(
                    api,
                    chat.chatId,
                    user.userId,
                    userIdsFromEvents($eventsStore)
                );
            } else {
                await updateDetails();
            }
        }
    }

    async function updateDetails(): Promise<void> {
        if (chat.kind === "group_chat") {
            if (
                $groupDetails !== undefined &&
                $groupDetails.latestEventIndex < chat.latestEventIndex
            ) {
                const gd = await api.getGroupDetailsUpdates(chat.chatId, $groupDetails);
                currentChatMembers.set(chat.chatId, gd.members);
                currentChatBlockedUsers.set(chat.chatId, gd.blockedUsers);
                currentChatPinnedMessages.set(chat.chatId, gd.pinnedMessages);
                groupDetails.set(chat.chatId, gd);
                await updateUserStore(
                    api,
                    chat.chatId,
                    user.userId,
                    userIdsFromEvents($eventsStore)
                );
            }
        }
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
            if (userGroupKeys.has(key)) {
                return key;
            }
        }
        const firstKey = prefix + first.index;
        userGroupKeys.add(firstKey);
        return firstKey;
    }

    function chatUpdated(affectedEvents: number[]): void {
        // The chat summary has been updated which means the latest message may be new
        const latestMessage = chat.latestMessage;
        if (latestMessage !== undefined && latestMessage.event.sender !== user.userId) {
            handleMessageSentByOther(latestMessage, true);
        }

        refreshAffectedEvents(affectedEvents);
        updateDetails();

        if (insideFromBottomThreshold && shouldLoadNewMessages()) {
            loadNewMessages();
        }
    }

    function refreshAffectedEvents(affectedEventIndexes: number[]): Promise<void> {
        const filtered = affectedEventIndexes.filter((e) =>
            indexIsInRanges(e, confirmedEventIndexesLoaded)
        );
        if (filtered.length === 0) {
            return Promise.resolve();
        }

        const eventsPromise =
            chat.kind === "direct_chat"
                ? api.directChatEventsByEventIndex(
                      chat.them,
                      filtered,
                      undefined,
                      chat.latestEventIndex
                  )
                : api.groupChatEventsByEventIndex(
                      chat.chatId,
                      filtered,
                      undefined,
                      chat.latestEventIndex
                  );

        return eventsPromise.then((resp) => handleEventsResponse(resp));
    }

    function handleMessageSentByOther(
        messageEvent: EventWrapper<Message>,
        confirmed: boolean
    ): void {
        if (indexIsInRanges(messageEvent.index, confirmedEventIndexesLoaded)) {
            // We already have this confirmed message
            return;
        }

        if (confirmed) {
            const isAdjacentToAlreadyLoadedEvents =
                indexIsInRanges(messageEvent.index - 1, confirmedEventIndexesLoaded) ||
                indexIsInRanges(messageEvent.index + 1, confirmedEventIndexesLoaded);

            if (!isAdjacentToAlreadyLoadedEvents) {
                return;
            }

            handleEventsResponse({
                events: [messageEvent],
                affectedEvents: [],
                latestEventIndex: undefined,
            });
        } else {
            if (!upToDate(chat, $eventsStore)) {
                return;
            }

            // If it is unconfirmed then we simply append it
            if (appendMessage(chat.chatId, messageEvent)) {
                unconfirmed.add(chat.chatId, messageEvent);
            }
        }

        onLoadedNewMessages(true);
    }

    $: groupedEvents = groupEvents($eventsStore, groupInner($filteredProposalsStore)).reverse();

    $: {
        if ($chatUpdatedStore !== undefined) {
            const aff = $chatUpdatedStore.affectedEvents;
            // we need to wait on a tick here to make sure that all the derived stores are up to date
            tick().then(() => {
                chatUpdated(aff);
                chatUpdatedStore.set(undefined);
            });
        }
    }

    $: {
        if (chat.chatId !== currentChatId) {
            currentChatId = chat.chatId;
            initialised = false;
            confirmedEventIndexesLoaded = new DRange();
            userGroupKeys = new Set<string>();

            if ($focusMessageIndex !== undefined) {
                loadEventWindow($focusMessageIndex);
            } else {
                loadPreviousMessages();
            }
            loadDetails();

            // FIXME
            // controller.subscribe((evt) => {
            //     switch (evt.event.kind) {
            //         case "sending_message":
            //             // smooth scroll doesn't work here when we are leaping from the top
            //             // which means we are stuck with abrupt scroll which is disappointing
            //             const { scroll } = evt.event;
            //             tick().then(() => scrollBottom(scroll));
            //             break;
            //         case "chat_updated":
            //             if (initialised && insideFromBottomThreshold && shouldLoadNewMessages()) {
            //                 controller.loadNewMessages();
            //             }
            //             break;
            //     }
            // });
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
            loadNewMessages();
        }
        if (shouldLoadPreviousMessages()) {
            loadingPrev = true;
            loadPreviousMessages();
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
            return messagesRead.isRead(chat.chatId, evt.event.messageIndex, evt.event.messageId);
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
        pinMessage(api, chat, ev.detail.messageIndex);
    }

    function onUnpinMessage(ev: CustomEvent<Message>) {
        if (!canPin) return;
        unpinMessage(api, chat, ev.detail.messageIndex);
    }

    function registerVote(
        ev: CustomEvent<{
            messageId: bigint;
            messageIndex: number;
            answerIndex: number;
            type: "register" | "delete";
        }>
    ) {
        registerPollVote(
            api,
            user.userId,
            chat.chatId,
            undefined,
            ev.detail.messageId,
            ev.detail.messageIndex,
            ev.detail.answerIndex,
            ev.detail.type
        );
    }

    function shareMessage(ev: CustomEvent<Message>) {
        shareFunctions.shareMessage(user.userId, ev.detail.sender === user.userId, ev.detail);
    }

    function copyMessageUrl(ev: CustomEvent<Message>) {
        shareFunctions.copyMessageUrl(chat.chatId, ev.detail.messageIndex);
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

    export function sendMessageWithAttachment(
        textContent: string | undefined,
        mentioned: User[],
        fileToAttach: MessageContent | undefined
    ) {
        if (!canSend) return;
        if (textContent || fileToAttach) {
            const storageRequired = getStorageRequiredForMessage(fileToAttach);
            if ($remainingStorage < storageRequired) {
                dispatch("upgrade", "explain");
                return;
            }

            const msg = createMessage(
                user.userId,
                $nextMessageIndex,
                textContent,
                $currentChatReplyingTo,
                fileToAttach
            );

            api.sendMessage(chat, user, mentioned, msg)
                .then(([resp, msg]) => {
                    if (resp.kind === "success" || resp.kind === "transfer_success") {
                        confirmMessage(msg, resp);
                        if (msg.kind === "message" && msg.content.kind === "crypto_content") {
                            api.refreshAccountBalance(
                                msg.content.transfer.token,
                                user.cryptoAccount
                            );
                        }
                        if (chat.kind === "direct_chat") {
                            trackEvent("sent_direct_message");
                        } else {
                            if (chat.public) {
                                trackEvent("sent_public_group_message");
                            } else {
                                trackEvent("sent_private_group_message");
                            }
                        }
                        if (msg.repliesTo !== undefined) {
                            // double counting here which I think is OK since we are limited to string events
                            trackEvent("replied_to_message");
                        }
                    } else {
                        removeMessage(chat, user.userId, msg.messageId, user.userId);
                        rollbar.warn("Error response sending message", resp);
                        toastStore.showFailureToast("errorSendingMessage");
                    }
                })
                .catch((err) => {
                    removeMessage(chat, user.userId, msg.messageId, user.userId);
                    console.log(err);
                    toastStore.showFailureToast("errorSendingMessage");
                    rollbar.error("Exception sending message", err);
                });

            const event = { event: msg, index: $nextEventIndex, timestamp: BigInt(Date.now()) };
            sendMessage(event);
        }
    }

    function confirmMessage(candidate: Message, resp: SendMessageSuccess | TransferSuccess): void {
        if (unconfirmed.delete(chat.chatId, candidate.messageId)) {
            messagesRead.confirmMessage(chat.chatId, resp.messageIndex, candidate.messageId);
            const confirmed = {
                event: mergeSendMessageResponse(candidate, resp),
                index: resp.eventIndex,
                timestamp: resp.timestamp,
            };
            serverEventsStore.update(chat.chatId, (events) =>
                events.map((e) => {
                    if (e.event === candidate) {
                        return confirmed;
                    }
                    return e;
                })
            );
            confirmedEventIndexesLoaded.add(resp.eventIndex);
            updateSummaryWithConfirmedMessage(chat.chatId, confirmed);
        }
    }

    async function sendMessage(messageEvent: EventWrapper<Message>): Promise<void> {
        let jumping = false;
        if (!upToDate(chat, $eventsStore)) {
            jumping = true;
            await loadEventWindow(chat.latestMessage!.event.messageIndex);
        }

        unconfirmed.add(chat.chatId, messageEvent);
        rtcConnectionsManager.sendMessage([...$currentChatUserIds], {
            kind: "remote_user_sent_message",
            chatType: chat.kind,
            chatId: chat.chatId,
            messageEvent: serialiseMessageForRtc(messageEvent),
            userId: user.userId,
        });

        // mark our own messages as read manually since we will not be observing them
        messagesRead.markMessageRead(
            chat.chatId,
            messageEvent.event.messageIndex,
            messageEvent.event.messageId
        );
        appendMessage(chat.chatId, messageEvent);

        currentChatDraftMessage.clear(chat.chatId);

        tick().then(() => scrollBottom(jumping ? "auto" : "smooth"));
    }

    export function forwardMessage(msg: Message) {
        if (!canSend || !canForward(msg.content)) return;

        // TODO check storage requirements

        // Only forward the primary content not the caption
        let content = { ...msg.content };
        if ("caption" in content) {
            content.caption = "";
        }

        msg = {
            kind: "message",
            messageId: newMessageId(),
            messageIndex: $nextMessageIndex,
            sender: user.userId,
            content,
            repliesTo: undefined,
            reactions: [],
            edited: false,
            forwarded: msg.content.kind !== "giphy_content",
        };

        api.sendMessage(chat, user, [], msg)
            .then(([resp, msg]) => {
                if (resp.kind === "success") {
                    confirmMessage(msg, resp);
                    trackEvent("forward_message");
                } else {
                    removeMessage(chat, user.userId, msg.messageId, user.userId);
                    rollbar.warn("Error response forwarding message", resp);
                    toastStore.showFailureToast("errorSendingMessage");
                }
            })
            .catch((err) => {
                removeMessage(chat, user.userId, msg.messageId, user.userId);
                console.log(err);
                toastStore.showFailureToast("errorSendingMessage");
                rollbar.error("Exception forwarding message", err);
            });

        const event = { event: msg, index: $nextEventIndex, timestamp: BigInt(Date.now()) };
        sendMessage(event);
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
                        collapsed={isCollapsed(evt, $filteredProposalsStore)}
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
        {:else if chat.kind === "group_chat"}
            <InitialGroupMessage group={chat} noVisibleEvents={$eventsStore.length === 0} />
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
