<script lang="ts">
    import type {
        ChatSummary,
        EventWrapper,
        Message,
        ChatEvent as ChatEventType,
        OpenChat,
        Mention,
        MessageContext,
    } from "openchat-client";
    import {
        ChatUpdated,
        LoadedMessageWindow,
        LoadedNewMessages,
        LoadedPreviousMessages,
        ReactionSelected,
        SendingMessage,
        SentMessage,
        messageContextsEqual,
    } from "openchat-client";
    import { menuStore } from "../../stores/menu";
    import { tooltipStore } from "../../stores/tooltip";
    import { rtlStore } from "../../stores/rtl";
    import { afterUpdate, beforeUpdate, getContext, onMount, tick } from "svelte";
    import { pathParams } from "../../routes";
    import ArrowDown from "svelte-material-icons/ArrowDown.svelte";
    import Fab from "../Fab.svelte";
    import { _ } from "svelte-i18n";
    import { pop } from "../../utils/transition";
    import { iconSize } from "../../stores/iconSize";
    import {
        eventListLastScrolled,
        eventListScrolling,
        reverseScroll,
    } from "../../stores/scrollPos";
    import TimelineDate from "./TimelineDate.svelte";

    // todo - these thresholds need to be relative to screen height otherwise things get screwed up on (relatively) tall screens
    const MESSAGE_READ_THRESHOLD = 500;
    const FROM_BOTTOM_THRESHOLD = 600;
    const LOADING_THRESHOLD = 400;
    const SCROLL_THRESHOLD = 500;
    const client = getContext<OpenChat>("client");

    export let rootSelector: string;
    export let unreadMessages: number;
    export let chat: ChatSummary;
    export let messagesDiv: HTMLDivElement | undefined;
    export let messagesDivHeight: number;
    export let initialised: boolean;
    export let events: EventWrapper<ChatEventType>[];
    export let readonly: boolean;
    export let firstUnreadMention: Mention | undefined;
    export let footer: boolean;
    export let threadRootEvent: EventWrapper<Message> | undefined;

    let interrupt = false;
    let morePrevAvailable = false;
    let moreNewAvailable = false;
    let loadingFromUserScroll = false;
    let previousScrollHeight: number | undefined = undefined;
    let previousScrollTop: number | undefined = undefined;
    let scrollingToMessage = false;
    let scrollToBottomOnSend = false;
    let destroyed = false;
    let messageObserver: IntersectionObserver;
    let labelObserver: IntersectionObserver;
    let messageReadTimers: Record<number, number> = {};

    $: user = client.user;
    $: userId = $user.userId;
    $: unconfirmed = client.unconfirmed;
    $: failedMessagesStore = client.failedMessagesStore;
    $: threadSummary = threadRootEvent?.event.thread;
    $: messageContext = {
        chatId: chat.id,
        threadRootMessageIndex: threadRootEvent?.event.messageIndex,
    };

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

    const bottom = () => {
        if (messagesDiv) {
            if (reverseScroll) {
                return 0;
            } else {
                return messagesDiv.scrollHeight - messagesDiv.clientHeight;
            }
        }
        return 0;
    };

    const fromBottom = () => {
        if (messagesDiv) {
            if (reverseScroll) {
                return -messagesDiv.scrollTop;
            } else {
                return bottom() - messagesDiv.scrollTop;
            }
        }
        return 0;
    };

    const fromTop = () => {
        if (messagesDiv) {
            if (reverseScroll) {
                return messagesDiv.scrollHeight - messagesDiv.clientHeight - fromBottom();
            } else {
                return messagesDiv.scrollTop;
            }
        }
        return 0;
    };

    const insideBottomThreshold = () => {
        return fromBottom() < LOADING_THRESHOLD;
    };

    const insideTopThreshold = () => {
        return fromTop() < LOADING_THRESHOLD;
    };

    let showGoToBottom = false;
    let floatingTimestamp: bigint | undefined = undefined;

    // use this when we need to be absolutely sure that we have the correct live value
    // rather than a stale dom reference
    function withScrollableElement(fn: (el: HTMLElement) => void) {
        const scrollableElement = document.getElementById(`scrollable-list-${rootSelector}`);
        if (scrollableElement) {
            fn(scrollableElement);
        }
    }

    beforeUpdate(() => {
        withScrollableElement((el) => {
            previousScrollHeight = el.scrollHeight;
            previousScrollTop = el.scrollTop;
        });
    });

    afterUpdate(() => {
        updateShowGoToBottom();
    });

    function elementIsOffTheTop(el: Element): boolean {
        return el.getBoundingClientRect().top < 95;
    }

    function updateShowGoToBottom() {
        showGoToBottom = fromBottom() > FROM_BOTTOM_THRESHOLD;
    }

    onMount(() => {
        const messageObserverOptions = {
            root: messagesDiv as Element,
            rootMargin: "0px",
            threshold: [0.1, 0.2, 0.3, 0.4, 0.5],
        };

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
                                messageObserver.unobserve(entry.target);
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
            if (!reverseScroll) {
                labels.reverse();
            }
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

        client.addEventListener("openchat_event", clientEvent);
        return () => {
            client.removeEventListener("openchat_event", clientEvent);
            destroyed = true;
        };
    });

    async function clientEvent(ev: Event): Promise<void> {
        await tick();
        if (ev instanceof LoadedNewMessages && !scrollingToMessage) {
            onLoadedNewMessages(ev.detail);
        }
        if (ev instanceof LoadedPreviousMessages && !scrollingToMessage) {
            onLoadedPreviousMessages(ev.detail.context, ev.detail.initializing);
        }
        if (ev instanceof LoadedMessageWindow) {
            onMessageWindowLoaded(ev.detail.context, ev.detail.messageIndex, ev.detail.initialLoad);
        }
        if (ev instanceof ChatUpdated && messageContextsEqual(ev.detail, messageContext)) {
            loadMoreIfRequired();
        }
        if (ev instanceof SentMessage && messageContextsEqual(ev.detail.context, messageContext)) {
            afterSendMessage(ev.detail.context, ev.detail.event);
        }
        if (ev instanceof SendingMessage && messageContextsEqual(ev.detail, messageContext)) {
            scrollToBottomOnSend = insideBottomThreshold();
        }
        if (ev instanceof ReactionSelected) {
            afterReaction(ev.detail.messageId, ev.detail.kind);
        }
    }

    async function afterReaction(messageId: bigint, kind: "add" | "remove") {
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
                top: bottom(),
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

    async function loadMoreIfRequired(fromScroll = false, initialLoad = false): Promise<boolean> {
        const loadingPrev = shouldLoadPreviousMessages();
        const loadingNew = shouldLoadNewMessages();
        loadingFromUserScroll = (loadingNew || loadingPrev) && fromScroll;
        const loadPromises = [];
        if (loadingNew) {
            console.debug("SCROLL: about to load new message");
            loadPromises.push(client.loadNewMessages(chat.id, threadRootEvent));
        }
        if (loadingPrev) {
            console.debug("SCROLL: about to load previous message");
            loadPromises.push(client.loadPreviousMessages(chat.id, threadRootEvent, initialLoad));
        }
        if (loadPromises.length > 0) {
            await Promise.all(loadPromises);
        }
        return loadingNew || loadingPrev;
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
                ($pathParams.kind === "global_chat_selected_route" ||
                    $pathParams.kind === "selected_channel_route") &&
                ($pathParams.open || $pathParams.threadMessageIndex !== undefined)
            ) {
                client.setFocusThreadMessageIndex(chat.id, $pathParams.threadMessageIndex);
                client.openThread(msgEvent, false);
            } else {
                client.closeThread();
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
            setFocusMessageIndex(undefined);
            return Promise.resolve();
        }

        scrollingToMessage = true;

        const element = findElementWithMessageIndex(index);
        if (element) {
            setFocusMessageIndex(index);
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
                            setFocusMessageIndex(undefined);
                        }
                    }, 200);
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

    export async function onMessageWindowLoaded(
        context: MessageContext,
        messageIndex: number | undefined,
        initialLoad = false,
    ) {
        if (messageIndex === undefined || initialLoad === false) return;
        await tick();
        if (!messageContextsEqual(context, messageContext)) return;
        initialised = true;
        await scrollToMessageIndex(context, messageIndex, false);
    }

    async function onLoadedPreviousMessages(context: MessageContext, initialLoad: boolean) {
        await tick();
        if (!messageContextsEqual(context, messageContext)) return;
        await resetScroll(initialLoad);
        if (!messageContextsEqual(context, messageContext)) return;
        if (reverseScroll) {
            // Seems like we *must* interrupt the scroll to stop runaway loading
            // even though we do not need to do any adjustment of the scrollTop in this direction.
            // This seems to help on chrome but not on safari (God help us).
            await interruptScroll(() => {
                console.debug("SCROLL: onLoadedPrevious interrupt");
            });
        } else {
            await adjustScrollTopIfNecessary(initialLoad, true);
        }
        await loadMoreIfRequired(loadingFromUserScroll, initialLoad);
    }

    async function onLoadedNewMessages(context: MessageContext) {
        await tick();
        if (!messageContextsEqual(context, messageContext)) return;

        if (reverseScroll) {
            await adjustScrollTopIfNecessary(false, false);
        }

        if (
            !loadingFromUserScroll &&
            !client.moreNewMessagesAvailable(chat.id, threadRootEvent) &&
            insideBottomThreshold()
        ) {
            // only scroll if we are now within threshold from the bottom
            scrollBottom("smooth");
        }

        await loadMoreIfRequired(loadingFromUserScroll);
    }

    async function adjustScrollTopIfNecessary(initialLoad: boolean, add: boolean): Promise<void> {
        withScrollableElement(async (el) => {
            if (
                !initialLoad &&
                previousScrollHeight !== undefined &&
                previousScrollTop !== undefined
            ) {
                const { scrollTop, scrollHeight } = el;
                const sensitivityThreshold = 100;
                const scrollHeightDiff = scrollHeight - previousScrollHeight;
                const scrollTopDiff = scrollTop - previousScrollTop;
                const diffDiff = scrollHeightDiff - scrollTopDiff;
                // sometimes chrome is *a little* out but it we only want to intervene if if's way off
                if (diffDiff > sensitivityThreshold) {
                    await interruptScroll(() => {
                        if (el !== undefined && previousScrollTop !== undefined) {
                            let adjusted = add
                                ? scrollTop + scrollHeightDiff
                                : scrollTop - scrollHeightDiff;
                            el.scrollTop = adjusted;
                            console.debug("SCROLL: adjusted: ", {
                                ...keyMeasurements(),
                                scrollHeightDiff,
                                scrollTopDiff,
                                reverseRender: reverseScroll,
                            });
                        }
                    });
                }
            }
        });
    }

    // this *looks* crazy - but the idea is that before we programmatically scroll the messages div
    // we set the overflow to hidden. This has the effect of immediately halting any momentum scrolling
    // on iOS which prevents the screen going black.
    // This also provides a robust way to short-circuit the scroll handler when we are programmatically scrolling
    function interruptScroll(fn: () => void): Promise<void> {
        interrupt = true;
        fn();
        return new Promise((resolve) => {
            window.requestAnimationFrame(() => {
                interrupt = false;
                resolve();
            });
        });
    }

    function onUserScroll() {
        trackScrollStop(SCROLL_THRESHOLD);
        updateShowGoToBottom();
        menuStore.hideMenu();
        tooltipStore.hide();
        eventListLastScrolled.set(Date.now());

        if (!initialised || interrupt || loadingFromUserScroll) return;

        loadMoreIfRequired(true);
    }

    async function loadIndexThenScrollToBottom(context: MessageContext, messageIndex: number) {
        await scrollToMessageIndex(context, messageIndex, false);
        if (messageContextsEqual(context, messageContext)) {
            await scrollBottom();
        }
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
        eventListScrolling.set(true);
        clearTimeout(scrollTimeout);
        scrollTimeout = window.setTimeout(() => {
            eventListScrolling.set(false);
        }, delay);
    }

    function setFocusMessageIndex(messageIndex: number | undefined) {
        if (threadRootEvent === undefined) {
            client.setFocusMessageIndex(chat.id, messageIndex);
        } else {
            client.setFocusThreadMessageIndex(chat.id, messageIndex);
        }
    }
</script>

{#if floatingTimestamp !== undefined}
    <TimelineDate observer={labelObserver} timestamp={BigInt(floatingTimestamp)} floating />
{/if}
<div
    id={`scrollable-list-${rootSelector}`}
    bind:this={messagesDiv}
    bind:clientHeight={messagesDivHeight}
    on:scroll={onUserScroll}
    class:interrupt
    class:reverse={reverseScroll}
    class={`scrollable-list ${rootSelector}`}>
    <slot {isConfirmed} {isFailed} {isReadByMe} {messageObserver} {labelObserver} />
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
    class:show={showGoToBottom || unreadMessages > 0}
    class="fab to-bottom"
    class:footer
    class:rtl={$rtlStore}>
    <Fab on:click={scrollToLast}>
        {#if loadingFromUserScroll}
            <div class="spinner" />
        {:else if unreadMessages > 0}
            <div in:pop={{ duration: 1500 }} class="unread">
                <div class="unread-count">{unreadMessages > 999 ? "999+" : unreadMessages}</div>
            </div>
        {:else}
            <ArrowDown size={$iconSize} color={"#fff"} />
        {/if}
    </Fab>
</div>

<style lang="scss">
    .scrollable-list {
        @include message-list();
        background-color: var(--currentChat-msgs-bg);

        &.reverse {
            display: flex;
            flex-direction: column-reverse;
        }

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
</style>
