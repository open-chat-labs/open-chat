<script lang="ts">
    import {
        ChatSummary,
        EventWrapper,
        LoadedMessageWindow,
        LoadedPreviousMessages,
        Message,
        ChatEvent as ChatEventType,
        OpenChat,
        SentMessage,
        LoadedNewMessages,
        Mention,
        LoadedPreviousThreadMessages,
        LoadedNewThreadMessages,
        LoadedThreadMessageWindow,
        ChatUpdated,
        SentThreadMessage,
        ThreadSummary,
        SendingMessage,
        SendingThreadMessage,
        ReactionSelected,
        ThreadReactionSelected,
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
    import { eventListScrollTop } from "../../stores/scrollPos";

    const FROM_BOTTOM_THRESHOLD = 600;
    const LOADING_THRESHOLD = 400;
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
    export let setFocusMessageIndex: (index: number | undefined) => void;
    export let selectedThreadKey: string | undefined;
    export let threadRootEvent: EventWrapper<Message> | undefined;
    export let maintainScroll: boolean;

    let interrupt = false;
    let morePrevAvailable = false;
    let moreNewAvailable = false;
    let loadingFromUserScroll = false;
    let previousScrollHeight: number | undefined = undefined;
    let previousScrollTop: number | undefined = undefined;
    let user = client.user;
    let scrollingToMessage = false;
    let scrollToBottomOnSend = false;

    $: failedMessagesStore = client.failedMessagesStore;
    $: threadSummary = threadRootEvent?.event.thread;

    const keyMeasurements = () => ({
        scrollHeight: messagesDiv!.scrollHeight,
        clientHeight: messagesDiv!.clientHeight,
        scrollTop: messagesDiv!.scrollTop,
        fromBottom: fromBottom(),
        insideBottomThreshold: insideBottomThreshold(),
        insideTopThreshold: insideTopThreshold(),
        loadingFromScroll: loadingFromUserScroll,
        eventCount: events.length,
    });

    const fromBottom = () => {
        if (messagesDiv) {
            const bottom = messagesDiv.scrollHeight - messagesDiv.clientHeight;
            return bottom - messagesDiv.scrollTop;
        }
        return 0;
    };

    const insideBottomThreshold = () => {
        return fromBottom() < LOADING_THRESHOLD;
    };

    const insideTopThreshold = () => {
        return (messagesDiv?.scrollTop ?? 0) < LOADING_THRESHOLD;
    };

    let showGoToBottom = false;

    beforeUpdate(() => {
        previousScrollHeight = messagesDiv?.scrollHeight;
        previousScrollTop = messagesDiv?.scrollTop;
    });

    afterUpdate(() => {
        showGoToBottom = fromBottom() > FROM_BOTTOM_THRESHOLD;
    });

    onMount(() => {
        if (messagesDiv !== undefined && $eventListScrollTop !== undefined && maintainScroll) {
            interruptScroll(() => {
                if (messagesDiv !== undefined && $eventListScrollTop !== undefined) {
                    initialised = true;
                    messagesDiv.scrollTop = $eventListScrollTop;
                }
            });
        }

        client.addEventListener("openchat_event", clientEvent);
        return () => {
            client.removeEventListener("openchat_event", clientEvent);
        };
    });

    async function clientEvent(ev: Event): Promise<void> {
        await tick();
        if (threadRootEvent === undefined) {
            if (ev instanceof LoadedNewMessages && !scrollingToMessage) {
                onLoadedNewMessages();
            }
            if (ev instanceof LoadedPreviousMessages && !scrollingToMessage) {
                onLoadedPreviousMessages(ev.detail);
            }
            if (ev instanceof LoadedMessageWindow) {
                onMessageWindowLoaded(ev.detail.messageIndex, ev.detail.initialLoad);
            }
            if (ev instanceof ChatUpdated) {
                loadMoreIfRequired();
            }
            if (ev instanceof SentMessage) {
                afterSendMessage();
            }
            if (ev instanceof SendingMessage) {
                scrollToBottomOnSend = insideBottomThreshold();
            }
            if (ev instanceof ReactionSelected) {
                afterReaction(ev.detail.messageId, ev.detail.kind);
            }
        }
        if (threadRootEvent !== undefined) {
            if (ev instanceof LoadedNewThreadMessages && !scrollingToMessage) {
                onLoadedNewMessages();
            }
            if (ev instanceof LoadedPreviousThreadMessages && !scrollingToMessage) {
                onLoadedPreviousMessages(ev.detail);
            }
            if (ev instanceof LoadedThreadMessageWindow) {
                onMessageWindowLoaded(ev.detail.messageIndex, ev.detail.initialLoad);
            }
            if (ev instanceof SentThreadMessage) {
                afterSendThreadMessage(threadRootEvent, ev.detail);
            }
            if (ev instanceof SendingThreadMessage) {
                scrollToBottomOnSend = insideBottomThreshold();
            }
            if (ev instanceof ThreadReactionSelected) {
                afterThreadReaction(ev.detail.messageId, ev.detail.kind);
            }
        }
    }

    async function afterReaction(messageId: bigint, kind: "add" | "remove") {
        if (
            !client.moreNewMessagesAvailable(chat.chatId, threadRootEvent) &&
            chat.latestMessage?.event?.messageId === messageId &&
            kind === "add" &&
            insideBottomThreshold()
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

    async function afterThreadReaction(messageId: bigint, kind: "add" | "remove") {
        if (
            !client.moreNewMessagesAvailable(chat.chatId, threadRootEvent) &&
            kind === "add" &&
            insideBottomThreshold()
        ) {
            const lastMessage = findLastMessage();
            if (lastMessage?.messageId === messageId) {
                await scrollBottom("smooth");
            }
        }
    }

    function afterSendThreadMessage(
        rootEvent: EventWrapper<Message>,
        event: EventWrapper<Message>
    ) {
        const summary: ThreadSummary = {
            participantIds: new Set<string>([user.userId]),
            numberOfReplies: event.event.messageIndex + 1,
            latestEventIndex: event.index,
            latestEventTimestamp: event.timestamp,
        };
        client.markThreadSummaryUpdated(rootEvent.event.messageId.toString(), summary);
        afterSendMessage();
    }

    async function afterSendMessage() {
        if (
            !client.moreNewMessagesAvailable(chat.chatId, threadRootEvent) &&
            scrollToBottomOnSend
        ) {
            await scrollBottom("smooth");
            scrollToBottomOnSend = false;
        }
    }

    async function scrollBottom(behavior: ScrollBehavior = "auto"): Promise<void> {
        return interruptScroll(() => {
            if (messagesDiv) {
                messagesDiv?.scrollTo({
                    top: messagesDiv.scrollHeight - messagesDiv.clientHeight,
                    behavior,
                });
            }
        });
    }

    function shouldLoadPreviousMessages() {
        morePrevAvailable = client.morePreviousMessagesAvailable(chat.chatId, threadRootEvent);
        return insideTopThreshold() && morePrevAvailable;
    }

    function shouldLoadNewMessages() {
        moreNewAvailable = client.moreNewMessagesAvailable(chat.chatId, threadRootEvent);
        return insideBottomThreshold() && moreNewAvailable;
    }

    async function loadMoreIfRequired(fromScroll = false, initialLoad = false): Promise<boolean> {
        const loadingPrev = shouldLoadPreviousMessages();
        const loadingNew = shouldLoadNewMessages();
        loadingFromUserScroll = (loadingNew || loadingPrev) && fromScroll;
        const loadPromises = [];
        if (loadingNew) {
            console.debug("SCROLL: about to load new message");
            loadPromises.push(client.loadNewMessages(chat.chatId, threadRootEvent));
        }
        if (loadingPrev) {
            console.debug("SCROLL: about to load previous message");
            loadPromises.push(
                client.loadPreviousMessages(chat.chatId, threadRootEvent, initialLoad)
            );
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
            scrollToMessageIndex(chat.chatId, mention.messageIndex, false);
        }
    }

    function scrollToElement(
        element: Element | null,
        behavior: ScrollBehavior = "auto"
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
                !failedMessagesStore.contains(selectedThreadKey ?? chat.chatId, ev.event.messageId)
        ) as EventWrapper<Message> | undefined;
    }

    function findElementWithMessageIndex(index: number): Element | null {
        return document.querySelector(`.${rootSelector} [data-index~='${index}']`);
    }

    function checkIfTargetMessageHasAThread(index: number) {
        const msgEvent = findMessageEvent(index);
        if (msgEvent && threadRootEvent === undefined) {
            if (msgEvent.event.thread !== undefined && $pathParams.open) {
                client.openThread(msgEvent, false);
            } else {
                client.closeThread();
            }
        }
    }

    export async function scrollToMessageIndex(
        chatId: string,
        index: number,
        preserveFocus: boolean
    ): Promise<void> {
        // it is possible for the chat to change while this function is recursing so double check
        if (chatId !== chat.chatId) return Promise.resolve();

        if (index < 0) {
            setFocusMessageIndex(undefined);
            return Promise.resolve();
        }

        scrollingToMessage = true;

        const element = findElementWithMessageIndex(index);
        if (element) {
            setFocusMessageIndex(index);
            await scrollToElement(element);
            checkIfTargetMessageHasAThread(index);
            if (await loadMoreIfRequired(false, true)) {
                return scrollToMessageIndex(chatId, index, preserveFocus);
            } else {
                if (!preserveFocus) {
                    window.setTimeout(() => {
                        setFocusMessageIndex(undefined);
                    }, 200);
                }
                scrollingToMessage = false;
                return Promise.resolve();
            }
        } else {
            await client.loadEventWindow(chatId, index, threadRootEvent);
            return scrollToMessageIndex(chatId, index, preserveFocus);
        }
    }

    export async function onMessageWindowLoaded(
        messageIndex: number | undefined,
        initialLoad = false
    ) {
        if (messageIndex === undefined || initialLoad === false) return;
        await tick();
        initialised = true;
        await scrollToMessageIndex(chat.chatId, messageIndex, false);
    }

    async function onLoadedPreviousMessages(initialLoad: boolean) {
        await tick();
        await resetScroll(initialLoad);
        if (
            !initialLoad &&
            messagesDiv !== undefined &&
            previousScrollHeight !== undefined &&
            previousScrollTop !== undefined
        ) {
            const sensitivityThreshold = 100;
            const scrollHeightDiff = messagesDiv.scrollHeight - previousScrollHeight;
            const scrollTopDiff = messagesDiv.scrollTop - previousScrollTop;
            const diffDiff = scrollHeightDiff - scrollTopDiff;
            // sometimes chrome is *a little* out but it we only want to intervene if if's way off
            if (diffDiff > sensitivityThreshold) {
                interruptScroll(() => {
                    if (messagesDiv !== undefined && previousScrollTop !== undefined) {
                        let adjusted = messagesDiv.scrollTop + scrollHeightDiff;
                        // This is still not great on iphone particularly in the groups that have a high proportion of non-message events
                        messagesDiv.scrollTop = adjusted;
                        console.debug("SCROLL: adjusted: ", {
                            ...keyMeasurements(),
                            scrollHeightDiff,
                            scrollTopDiff,
                        });
                    }
                });
            }
        }
        await loadMoreIfRequired(loadingFromUserScroll, initialLoad);
    }

    async function onLoadedNewMessages() {
        if (
            !loadingFromUserScroll &&
            !client.moreNewMessagesAvailable(chat.chatId, threadRootEvent) &&
            insideBottomThreshold()
        ) {
            // only scroll if we are now within threshold from the bottom
            await scrollBottom("smooth");
        }

        await loadMoreIfRequired(loadingFromUserScroll);
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
        if (maintainScroll) {
            $eventListScrollTop = messagesDiv?.scrollTop;
        }
        menuStore.hideMenu();
        tooltipStore.hide();

        if (!initialised || interrupt || loadingFromUserScroll) return;

        loadMoreIfRequired(true);
    }

    async function loadIndexThenScrollToBottom(messageIndex: number) {
        await scrollToMessageIndex(chat.chatId, messageIndex, false);
        await scrollBottom();
    }

    function scrollToLast() {
        if (threadSummary !== undefined) {
            loadIndexThenScrollToBottom(threadSummary.numberOfReplies - 1);
        } else {
            loadIndexThenScrollToBottom(chat.latestMessage?.event.messageIndex ?? -1);
        }
    }
</script>

<div
    bind:this={messagesDiv}
    bind:clientHeight={messagesDivHeight}
    on:scroll={onUserScroll}
    class:interrupt
    class={`scrollable-list ${rootSelector}`}>
    <slot />
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

<style type="text/scss">
    .scrollable-list {
        @include message-list();
        background-color: var(--currentChat-msgs-bg);

        &.interrupt {
            overflow-y: hidden;
        }
    }

    .spinner {
        @include loading-spinner(1em, 0.5em, var(--button-spinner), "../assets/plain-spinner.svg");
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
