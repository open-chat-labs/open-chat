<script lang="ts" module>
    export type ChatEventListArgs = {
        isAccepted: (_unconf: unknown, evt: EventWrapper<ChatEventType>) => boolean;
        isConfirmed: (_unconf: unknown, evt: EventWrapper<ChatEventType>) => boolean;
        isFailed: (_failed: unknown, evt: EventWrapper<ChatEventType>) => boolean;
        isReadByMe: (_store: unknown, evt: EventWrapper<ChatEventType>) => boolean;
        messageObserver: IntersectionObserver | undefined;
        labelObserver: IntersectionObserver | undefined;
        focusIndex: number | undefined;
    };
</script>

<script lang="ts">
    import {
        MessageContextMap,
        failedMessagesStore,
        messageContextsEqual,
        pathState,
        subscribe,
        ui,
        unconfirmed,
        currentUser as user,
        type ChatEvent as ChatEventType,
        type ChatSummary,
        type EventWrapper,
        type Mention,
        type Message,
        type MessageContext,
        type OpenChat,
    } from "openchat-client";
    import { getContext, onMount, tick, type Snippet } from "svelte";
    import { _ } from "svelte-i18n";
    import ArrowDown from "svelte-material-icons/ArrowDown.svelte";
    import ArrowUp from "svelte-material-icons/ArrowUp.svelte";
    import { menuStore } from "../../stores/menu";
    import { rtlStore } from "../../stores/rtl";
    import { tooltipStore } from "../../stores/tooltip";
    import { pop } from "../../utils/transition";
    import Fab from "../Fab.svelte";
    import TimelineDate from "./TimelineDate.svelte";

    // todo - these thresholds need to be relative to screen height otherwise things get screwed up on (relatively) tall screens
    const MESSAGE_READ_THRESHOLD = 500;
    const FROM_END_THRESHOLD = 600;
    const LOADING_THRESHOLD = 400;
    const SCROLL_THRESHOLD = 500;
    const client = getContext<OpenChat>("client");

    interface Props {
        rootSelector: string;
        unreadMessages: number;
        chat: ChatSummary;
        messagesDiv: HTMLDivElement | undefined;
        messagesDivHeight: number;
        initialised: boolean;
        events: EventWrapper<ChatEventType>[];
        readonly: boolean;
        firstUnreadMention: Mention | undefined;
        footer: boolean;
        threadRootEvent: EventWrapper<Message> | undefined;
        maintainScroll: boolean;
        scrollTopButtonEnabled?: boolean;
        children?: Snippet<[ChatEventListArgs]>;
    }

    let {
        rootSelector,
        unreadMessages,
        chat,
        messagesDiv = $bindable(),
        messagesDivHeight = $bindable(),
        initialised = $bindable(),
        events,
        readonly,
        firstUnreadMention,
        footer,
        threadRootEvent,
        maintainScroll,
        scrollTopButtonEnabled = false,
        children,
    }: Props = $props();

    let focusIndex = $state<number | undefined>();
    let interrupt = $state(false);
    let morePrevAvailable = false;
    let moreNewAvailable = false;
    let loadingFromUserScroll = $state(false);
    let previousScrollHeight: MessageContextMap<number> = new MessageContextMap();
    let previousScrollTopByHeight: MessageContextMap<Record<number, number>> =
        new MessageContextMap();
    let scrollingToMessage = false;
    let scrollToBottomOnSend = false;
    let destroyed = false;
    let messageObserver: IntersectionObserver | undefined = $state();
    let labelObserver: IntersectionObserver | undefined = $state();
    let heightObserver: MutationObserver;
    let messageReadTimers: Record<number, number> = {};

    let userId = $derived($user.userId);
    let threadSummary = $derived(threadRootEvent?.event.thread);
    let messageContext = $derived({
        chatId: chat?.id,
        threadRootMessageIndex: threadRootEvent?.event.messageIndex,
    });

    // use this when it's critical that we get the live value from the dom and
    // not a potentially stale value from the captured variable
    function withScrollableElement(fn: (el: HTMLElement) => void) {
        const el = document.getElementById(`scrollable-list-${rootSelector}`);
        if (el) {
            fn(el);
        }
    }

    const keyMeasurements = () => ({
        scrollHeight: messagesDiv!.scrollHeight,
        clientHeight: messagesDiv!.clientHeight,
        scrollTop: messagesDiv!.scrollTop,
        fromBottom: fromBottom(),
        fromTop: fromTop(),
        insideBottomThreshold: insideBottomThreshold(),
        insideTopThreshold: insideTopThreshold(),
        loadingFromScroll: loadingFromUserScroll,
        eventCount: events.length,
    });

    const fromBottom = () => {
        if (messagesDiv) {
            return -messagesDiv.scrollTop;
        }
        return 0;
    };

    const fromTop = () => {
        if (messagesDiv) {
            return messagesDiv.scrollHeight - messagesDiv.clientHeight - fromBottom();
        }
        return 0;
    };

    const insideBottomThreshold = () => {
        return fromBottom() < LOADING_THRESHOLD;
    };

    const insideTopThreshold = () => {
        return fromTop() < LOADING_THRESHOLD;
    };

    let showGoToBottom = $state(false);
    let showGoToTop = $state(false);
    let floatingTimestamp: bigint | undefined = $state(undefined);
    let loadingNewMessages = false;
    let loadingPrevMessages = false;

    $effect.pre(() => {
        withScrollableElement((el) => {
            const scrollTopByHeight = previousScrollTopByHeight.get(messageContext) ?? {};
            scrollTopByHeight[el.scrollHeight] = el.scrollTop;
            previousScrollTopByHeight.set(messageContext, scrollTopByHeight);
        });
    });

    $effect(() => {
        updateShowGoToBottom();
        updateShowGoToTop();
    });

    function elementIsOffTheTop(el: Element): boolean {
        return el.getBoundingClientRect().top < 95;
    }

    function updateShowGoToBottom() {
        showGoToBottom = fromBottom() > FROM_END_THRESHOLD;
    }

    function updateShowGoToTop() {
        showGoToTop = fromTop() > FROM_END_THRESHOLD;
    }

    onMount(() => {
        const messageObserverOptions = {
            root: messagesDiv as Element,
            rootMargin: "0px",
            threshold: [0.1, 0.2, 0.3, 0.4, 0.5],
        };

        heightObserver = new MutationObserver((_: MutationRecord[]) => {
            withScrollableElement(async (el) => {
                const previousScrollHeightVal = previousScrollHeight.get(messageContext);
                if (
                    el.scrollHeight !== previousScrollHeightVal &&
                    previousScrollHeightVal !== undefined
                ) {
                    const scrollHeightDiff = el.scrollHeight - previousScrollHeightVal;
                    const scrollTopByHeight = previousScrollTopByHeight.get(messageContext) ?? {};
                    const previousScrollTop = scrollTopByHeight[previousScrollHeightVal] ?? 0;

                    const scrollTopDiff = Math.abs(el.scrollTop - previousScrollTop);
                    const sensitivityThreshold = 100;
                    const diffDiff = Math.abs(scrollHeightDiff - scrollTopDiff);
                    const needsAdjustment =
                        loadingFromUserScroll && diffDiff > sensitivityThreshold;

                    if (scrollHeightDiff > 0) {
                        console.debug(
                            `SCROLL: scrollHeight has changed from: ${previousScrollHeightVal} to: ${el.scrollHeight}`,
                        );
                    }
                    if (scrollTopDiff > 0) {
                        console.debug(
                            `SCROLL: scrollTop has changed from: ${previousScrollTop} to: ${el.scrollTop}`,
                        );
                    }

                    if (needsAdjustment) {
                        if (loadingNewMessages && !loadingPrevMessages) {
                            await interruptScroll((el) => {
                                if (previousScrollTop !== undefined) {
                                    el.scrollTop = previousScrollTop - scrollHeightDiff;
                                }
                            });
                        }
                        console.debug("SCROLL: adjusted: ", {
                            ...keyMeasurements(),
                            scrollTop: el.scrollTop,
                            scrollHeight: el.scrollHeight,
                            scrollHeightDiff,
                            scrollTopDiff,
                        });
                    }

                    // after the scroll height has changed, make sure that we check whether we need to load more messages
                    if (loadingFromUserScroll) {
                        await loadMoreIfRequired(loadingFromUserScroll);
                    }
                }
                previousScrollHeight.set(messageContext, el.scrollHeight);
            });
        });

        if (messagesDiv) {
            heightObserver.observe(messagesDiv!, {
                attributes: true,
                childList: true,
                subtree: true,
                attributeFilter: ["scrollHeight"],
            });
        }

        messageObserver = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
            entries.forEach((entry) => {
                const idxAttrs = entry.target.attributes.getNamedItem("data-index");
                const idAttr = entry.target.attributes.getNamedItem("data-id");
                const idx = idxAttrs
                    ? Math.max(...idxAttrs.value.split(" ").map((v) => parseInt(v, 10)))
                    : undefined;
                const id = idAttr ? BigInt(idAttr.value) : undefined;
                if (idx !== undefined) {
                    const intersectionRatioRequired =
                        0 < messagesDivHeight && messagesDivHeight < entry.boundingClientRect.height
                            ? (messagesDivHeight * 0.5) / entry.boundingClientRect.height
                            : 0.5;

                    const isIntersecting = entry.intersectionRatio >= intersectionRatioRequired;
                    if (isIntersecting && messageReadTimers[idx] === undefined) {
                        const context = messageContext;
                        const timer = window.setTimeout(() => {
                            if (messageContextsEqual(context, messageContext)) {
                                client.markMessageRead(messageContext, idx, id);
                                messageObserver?.unobserve(entry.target);
                            }
                            delete messageReadTimers[idx];
                        }, MESSAGE_READ_THRESHOLD);
                        messageReadTimers[idx] = timer;
                    }
                    if (!isIntersecting && messageReadTimers[idx] !== undefined) {
                        window.clearTimeout(messageReadTimers[idx]);
                        delete messageReadTimers[idx];
                    }
                }
            });
        }, messageObserverOptions);

        const labelObserverOptions = {
            root: messagesDiv as Element,
            rootMargin: "-15px 0px 0px 0px",
            threshold: [0, 0.5, 1],
        };

        labelObserver = new IntersectionObserver((_entries: IntersectionObserverEntry[]) => {
            const labels = [
                ...(messagesDiv?.querySelectorAll(".date-label[data-timestamp]:not(.floating)") ??
                    []),
            ];
            floatingTimestamp = undefined;
            for (const label of labels) {
                const float = elementIsOffTheTop(label);
                if (float && floatingTimestamp === undefined) {
                    (label as HTMLElement).style.opacity = "0";
                    const timestamp = label.getAttribute("data-timestamp");
                    if (timestamp != null) {
                        floatingTimestamp = BigInt(timestamp);
                    }
                } else {
                    (label as HTMLElement).style.opacity = "1";
                }
            }
        }, labelObserverOptions);

        if (ui.eventListScrollTop !== undefined && maintainScroll) {
            interruptScroll((el) => {
                if (ui.eventListScrollTop !== undefined) {
                    initialised = true;
                    el.scrollTop = ui.eventListScrollTop;
                }
            });
        }

        const unsubs = [
            subscribe("chatUpdated", chatsUpdated),
            subscribe("reactionSelected", afterReaction),
            subscribe("sendingMessage", sendingMessage),
            subscribe("sentMessage", sentMessage),
            subscribe("loadedMessageWindow", onMessageWindowLoaded),
            subscribe(
                "loadedNewMessages",
                (args) => !scrollingToMessage && onLoadedNewMessages(args),
            ),
            subscribe(
                "loadedPreviousMessages",
                (args) => !scrollingToMessage && onLoadedPreviousMessages(args),
            ),
        ];
        return () => {
            heightObserver.disconnect();
            unsubs.forEach((u) => u());
            destroyed = true;
        };
    });

    function chatsUpdated(ctx: MessageContext) {
        if (messageContextsEqual(ctx, messageContext)) {
            // I *think* chatsUpdated is only going to be because there are new messages to load
            // so there is no need to load more previous messages. It's better that we don't even check
            // here because in certain race conditions we might ending up loading the previous messages twice.
            loadNewMessagesIfRequired();
        }
    }

    function sendingMessage(ctx: MessageContext) {
        if (messageContextsEqual(ctx, messageContext)) {
            scrollToBottomOnSend = insideBottomThreshold();
        }
    }

    function sentMessage(payload: { context: MessageContext; event: EventWrapper<Message> }) {
        if (messageContextsEqual(payload.context, messageContext)) {
            afterSendMessage(payload.context, payload.event);
        }
    }

    async function afterReaction({
        messageId,
        kind,
    }: {
        messageId: bigint;
        kind: "add" | "remove";
    }) {
        if (
            !client.moreNewMessagesAvailable(chat.id, threadRootEvent) &&
            kind === "add" &&
            insideBottomThreshold() &&
            findLastMessage()?.messageId === messageId
        ) {
            await scrollBottom("smooth");
        }
    }

    function findLastMessage(): Message | undefined {
        for (let i = events.length - 1; i >= 0; i--) {
            if (events[i].event.kind === "message") {
                return events[i].event as Message;
            }
        }
    }

    async function afterSendMessage(context: MessageContext, event: EventWrapper<Message>) {
        if (context.threadRootMessageIndex !== undefined && threadRootEvent !== undefined) {
            const summary = {
                participantIds: new Set<string>([userId]),
                numberOfReplies: event.event.messageIndex + 1,
                latestEventIndex: event.index,
                latestEventTimestamp: event.timestamp,
            };
            client.markThreadSummaryUpdated(threadRootEvent.event.messageId, summary);
        }

        if (!client.moreNewMessagesAvailable(chat.id, threadRootEvent) && scrollToBottomOnSend) {
            await scrollBottom("smooth");
            scrollToBottomOnSend = false;
        }
    }

    async function scrollBottom(
        behavior: ScrollBehavior = "auto",
        retries: number = 0,
    ): Promise<void> {
        if (messagesDiv) {
            messagesDiv?.scrollTo({
                top: 0,
                behavior,
            });
        }
        if (retries < 3) {
            // this weird retry loop appears to be necessary on safari. Three ... is the magic number
            window.setTimeout(() => scrollBottom(behavior, retries + 1), 0);
        }
    }

    function shouldLoadPreviousMessages() {
        morePrevAvailable = client.morePreviousMessagesAvailable(chat.id, threadRootEvent);
        return insideTopThreshold() && morePrevAvailable;
    }

    function shouldLoadNewMessages() {
        moreNewAvailable = client.moreNewMessagesAvailable(chat.id, threadRootEvent);
        return insideBottomThreshold() && moreNewAvailable;
    }

    async function loadNewMessagesIfRequired(fromScroll = false): Promise<boolean> {
        loadingNewMessages = shouldLoadNewMessages();
        loadingFromUserScroll = loadingNewMessages && fromScroll;
        const loadPromises = [];
        if (loadingNewMessages) {
            console.debug("SCROLL: about to load new message");
            loadPromises.push(client.loadNewMessages(chat.id, threadRootEvent));
        }
        if (loadPromises.length > 0) {
            await Promise.all(loadPromises);
        }
        return loadingNewMessages;
    }

    async function loadMoreIfRequired(fromScroll = false, initialLoad = false): Promise<boolean> {
        loadingPrevMessages = shouldLoadPreviousMessages();
        loadingNewMessages = shouldLoadNewMessages();
        loadingFromUserScroll = (loadingPrevMessages || loadingNewMessages) && fromScroll;
        const loadPromises = [];
        if (loadingNewMessages) {
            console.debug("SCROLL: about to load new message");
            loadPromises.push(client.loadNewMessages(chat.id, threadRootEvent));
        }
        if (loadingPrevMessages) {
            console.debug("SCROLL: about to load previous message");
            loadPromises.push(client.loadPreviousMessages(chat.id, threadRootEvent, initialLoad));
        }
        if (loadPromises.length > 0) {
            await Promise.all(loadPromises);
        }
        return loadingNewMessages || loadingPrevMessages;
    }

    async function resetScroll(initialLoad: boolean) {
        if (initialLoad) {
            await scrollBottom("auto");
        }
        if (!initialised) {
            initialised = true;
        }
    }

    function scrollToMention(mention: Mention | undefined) {
        if (mention !== undefined) {
            scrollToMessageIndex(messageContext, mention.messageIndex, false);
        }
    }

    function scrollToElement(
        element: Element | null,
        behavior: ScrollBehavior = "auto",
    ): Promise<void> {
        return interruptScroll(() => {
            element?.scrollIntoView({ behavior, block: "center" });
        });
    }

    function findMessageEvent(index: number): EventWrapper<Message> | undefined {
        return events.find(
            (ev) =>
                ev.event.kind === "message" &&
                ev.event.messageIndex === index &&
                (messageContext === undefined ||
                    !failedMessagesStore.contains(messageContext, ev.event.messageId)),
        ) as EventWrapper<Message> | undefined;
    }

    function findElementWithMessageIndex(index: number): Element | null {
        return document.querySelector(`.${rootSelector} [data-index~='${index}']`);
    }

    function isAccepted(_unconf: unknown, evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message" && messageContext) {
            return !unconfirmed.pendingAcceptance(messageContext, evt.event.messageId);
        }
        return true;
    }

    function isConfirmed(_unconf: unknown, evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message" && messageContext) {
            return !unconfirmed.contains(messageContext, evt.event.messageId);
        }
        return true;
    }

    function isFailed(_failed: unknown, evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message" && messageContext) {
            return failedMessagesStore.contains(messageContext, evt.event.messageId);
        }
        return false;
    }

    function isReadByMe(_store: unknown, evt: EventWrapper<ChatEventType>): boolean {
        if (readonly || (evt.event.kind === "message" && evt.event.sender === userId)) return true;

        if (evt.event.kind === "message" || evt.event.kind === "aggregate_common_events") {
            let messageIndex =
                evt.event.kind === "message"
                    ? evt.event.messageIndex
                    : Math.max(...evt.event.messagesDeleted);
            let messageId = evt.event.kind === "message" ? evt.event.messageId : undefined;
            return client.isMessageRead(messageContext, messageIndex, messageId);
        }
        return true;
    }

    function checkIfTargetMessageHasAThread(index: number) {
        const msgEvent = findMessageEvent(index);
        if (msgEvent && threadRootEvent === undefined) {
            if (
                msgEvent.event.thread !== undefined &&
                (pathState.route.kind === "global_chat_selected_route" ||
                    pathState.route.kind === "selected_channel_route") &&
                (pathState.route.open || pathState.route.threadMessageIndex !== undefined)
            ) {
                client.openThread(msgEvent, false, pathState.route.threadMessageIndex);
            }
        }
    }

    export async function scrollToMessageIndex(
        context: MessageContext,
        index: number,
        preserveFocus: boolean,
        filling: boolean = false,
        hasLookedUpEvent: boolean = false,
    ): Promise<void> {
        // it is possible for the chat to change while this function is recursing so double check
        if (!messageContextsEqual(context, messageContext)) return Promise.resolve();

        if (index < 0) {
            focusIndex = undefined;
            return Promise.resolve();
        }

        scrollingToMessage = true;

        const element = findElementWithMessageIndex(index);
        if (element) {
            focusIndex = index;
            await scrollToElement(element);
            if (!messageContextsEqual(context, messageContext)) return Promise.resolve();
            if (!filling) {
                // if we are not filling in extra events around the target then check if we need to open a thread
                checkIfTargetMessageHasAThread(index);
            }
            if (await loadMoreIfRequired(false, true)) {
                return scrollToMessageIndex(context, index, preserveFocus, true);
            } else {
                if (!preserveFocus) {
                    window.setTimeout(() => {
                        if (messageContextsEqual(context, messageContext)) {
                            focusIndex = undefined;
                        }
                    }, 500);
                }
                scrollingToMessage = false;
                return Promise.resolve();
            }
        } else if (!destroyed) {
            // check whether we have already loaded the event we are looking for
            const loaded = findMessageEvent(index);
            if (loaded === undefined) {
                if (!hasLookedUpEvent) {
                    // we must only recurse if we have not already loaded the event, otherwise we will enter an infinite loop
                    await client.loadEventWindow(context.chatId, index, threadRootEvent);
                    return scrollToMessageIndex(context, index, preserveFocus, filling, true);
                }
            } else {
                // if we got here it means that we could not find the DOM element for and event that we
                // have already loaded. This isn't necessarily an error since a message might have been hidden
                // but it's still not clear what to do in this circumstance because we cannot
                // scroll to this message and there is nothing that we can do about it. So where *do* we scroll?
                // The *next* message?, the bottom?, nowhere?
                const nextMessage = findElementWithMessageIndex(index + 1);
                return nextMessage
                    ? scrollToMessageIndex(context, index + 1, preserveFocus, filling)
                    : scrollBottom();
            }
        }
    }

    export async function onMessageWindowLoaded({
        context,
        messageIndex,
        initialLoad,
    }: {
        context: MessageContext;
        messageIndex: number | undefined;
        initialLoad: boolean;
    }) {
        if (messageIndex === undefined || initialLoad === false) return;
        await tick();
        if (!messageContextsEqual(context, messageContext)) return;
        initialised = true;
        await scrollToMessageIndex(context, messageIndex, false);
    }

    async function onLoadedPreviousMessages({
        context,
        initialLoad,
    }: {
        context: MessageContext;
        initialLoad: boolean;
    }) {
        if (!messageContextsEqual(context, messageContext)) return;
        await resetScroll(initialLoad);
        if (!messageContextsEqual(context, messageContext)) return;
        // Seems like we *must* interrupt the scroll to stop runaway loading
        // even though we do not need to do any adjustment of the scrollTop in this direction.
        // This seems to help on chrome but not on safari (God help us).
        await interruptScroll(() => {
            console.debug("SCROLL: onLoadedPrevious interrupt");
        });

        // It is possible the when we load previous messages, because of the filtering applied, we might not
        // have enough events. To cover that case we will check if we need to load some more.
        loadMoreIfRequired();
    }

    async function onLoadedNewMessages(context: MessageContext) {
        if (!messageContextsEqual(context, messageContext)) return;

        if (
            !loadingFromUserScroll &&
            !client.moreNewMessagesAvailable(chat.id, threadRootEvent) &&
            insideBottomThreshold()
        ) {
            // only scroll if we are now within threshold from the bottom
            scrollBottom("smooth");
        }
    }

    // this *looks* crazy - but the idea is that before we programmatically scroll the messages div
    // we set the overflow to hidden. This has the effect of immediately halting any momentum scrolling
    // on iOS which prevents the screen going black.
    // This also provides a robust way to short-circuit the scroll handler when we are programmatically scrolling
    function interruptScroll(fn: (el: HTMLElement) => void): Promise<void> {
        interrupt = true;
        withScrollableElement(fn);
        return new Promise((resolve) => {
            window.requestAnimationFrame(() => {
                interrupt = false;
                resolve();
            });
        });
    }

    function onUserScroll() {
        trackScrollStop(SCROLL_THRESHOLD);
        if (maintainScroll) {
            ui.eventListScrollTop = messagesDiv?.scrollTop;
        }
        updateShowGoToBottom();
        updateShowGoToTop();
        menuStore.hideMenu();
        tooltipStore.hide();
        ui.eventListLastScrolled = Date.now();

        if (!initialised || interrupt || loadingFromUserScroll) return;

        loadMoreIfRequired(true);
    }

    async function loadIndexThenScrollToBottom(context: MessageContext, messageIndex: number) {
        await scrollToMessageIndex(context, messageIndex, false);
        if (messageContextsEqual(context, messageContext)) {
            await scrollBottom();
        }
    }

    function scrollToTop() {
        scrollToMessageIndex(messageContext, 0, false);
    }

    function scrollToLast() {
        if (threadSummary !== undefined) {
            loadIndexThenScrollToBottom(messageContext, threadSummary.numberOfReplies - 1);
        } else {
            loadIndexThenScrollToBottom(
                messageContext,
                chat.latestMessage?.event.messageIndex ?? -1,
            );
        }
    }

    let scrollTimeout: number | undefined = undefined;
    function trackScrollStop(delay: number) {
        ui.eventListScrolling = true;
        clearTimeout(scrollTimeout);
        scrollTimeout = window.setTimeout(() => {
            ui.eventListScrolling = false;
        }, delay);
    }

    // function setFocusMessageIndex(messageIndex: number | undefined) {
    //     focusIndex = messageIndex;
    //     // if (threadRootEvent === undefined) {
    //     //     client.setFocusMessageIndex(context, messageIndex);
    //     // } else {
    //     //     client.setFocusThreadMessageIndex(context, messageIndex);
    //     // }
    // }
</script>

{#if floatingTimestamp !== undefined && labelObserver !== undefined}
    <TimelineDate observer={labelObserver} timestamp={BigInt(floatingTimestamp)} floating />
{/if}
<div
    id={`scrollable-list-${rootSelector}`}
    bind:this={messagesDiv}
    bind:clientHeight={messagesDivHeight}
    onscroll={onUserScroll}
    class:interrupt
    class={`scrollable-list ${rootSelector}`}>
    {@render children?.({
        isAccepted,
        isConfirmed,
        isFailed,
        isReadByMe,
        messageObserver,
        labelObserver,
        focusIndex,
    })}
</div>

{#if scrollTopButtonEnabled}
    <div
        title={$_("scrollToTop")}
        class:show={showGoToTop}
        class="fab to-top"
        class:rtl={$rtlStore}>
        <Fab on:click={scrollToTop}>
            <ArrowUp size={ui.iconSize} color={"#fff"} />
        </Fab>
    </div>
{/if}

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
    class:show={showGoToBottom || unreadMessages > 0}
    class="fab to-bottom"
    class:footer
    class:rtl={$rtlStore}>
    <Fab on:click={scrollToLast}>
        {#if loadingFromUserScroll}
            <div class="spinner"></div>
        {:else if unreadMessages > 0}
            <div in:pop={{ duration: 1500 }} class="unread">
                <div class="unread-count">{unreadMessages > 999 ? "999+" : unreadMessages}</div>
            </div>
        {:else}
            <ArrowDown size={ui.iconSize} color={"#fff"} />
        {/if}
    </Fab>
</div>

<style lang="scss">
    .scrollable-list {
        @include message-list();
        background-color: var(--currentChat-msgs-bg);
        display: flex;
        flex-direction: column-reverse;

        &.interrupt {
            overflow-y: hidden;
        }
    }

    .spinner {
        @include loading-spinner(1em, 0.5em, var(--button-spinner), "/assets/plain-spinner.svg");
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

    .unread {
        color: var(--button-txt);
        text-align: center;
        text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.5);

        .unread-count {
            line-height: 80%;
        }
    }

    .to-bottom {
        bottom: 24px;
        &.footer {
            bottom: 80px;
        }
    }

    .to-top {
        top: 95px;
        height: $sp7;
    }
</style>
