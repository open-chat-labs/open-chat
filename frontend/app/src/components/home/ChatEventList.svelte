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
    // import { dimensions } from "../../stores/screenDimensions";

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
    export let focusMessageIndex: number | undefined = undefined;
    export let readonly: boolean;
    export let firstUnreadMention: Mention | undefined;
    export let footer: boolean;
    export let setFocusMessageIndex: (index: number | undefined) => void;
    export let selectedThreadKey: string | undefined;
    export let threadRootEvent: EventWrapper<Message> | undefined;

    let interrupt = false;
    let morePrevAvailable = false;
    let moreNewAvailable = false;
    let loadingPrev = false;
    let loadingNew = false;
    let loadingFromScroll = false;
    let scrollingToMessage = false;
    let scrollTimer: number | undefined;
    let previousScrollHeight: number | undefined = undefined;
    let previousScrollTop: number | undefined = undefined;
    let user = client.user;
    let scrollToBottomAfterLoad = false;

    $: failedMessagesStore = client.failedMessagesStore;
    $: threadSummary = threadRootEvent?.event.thread;

    const keyMeasurements = () => ({
        scrollHeight: messagesDiv!.scrollHeight,
        clientHeight: messagesDiv!.clientHeight,
        scrollTop: messagesDiv!.scrollTop,
        fromBottom: fromBottom(),
        insideBottomThreshold: insideBottomThreshold(),
        insideTopThreshold: insideTopThreshold(),
        loadingNew,
        loadingPrev,
        loadingFromScroll,
        scrollingToMessage,
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
        // return fromBottom() < $dimensions.height;
        return fromBottom() < LOADING_THRESHOLD;
    };

    const insideTopThreshold = () => {
        // return (messagesDiv?.scrollTop ?? 0) < $dimensions.height;
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
        client.addEventListener("openchat_event", clientEvent);
        return () => {
            client.removeEventListener("openchat_event", clientEvent);
        };
    });

    async function clientEvent(ev: Event): Promise<void> {
        await tick();
        if (threadRootEvent === undefined) {
            if (ev instanceof LoadedNewMessages) {
                onLoadedNewMessages(ev.detail);
            }
            if (ev instanceof LoadedPreviousMessages) {
                onLoadedPreviousMessages(ev.detail);
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
        if (threadRootEvent !== undefined) {
            if (ev instanceof LoadedNewThreadMessages) {
                onLoadedNewMessages(ev.detail);
            }
            if (ev instanceof LoadedPreviousThreadMessages) {
                onLoadedPreviousMessages(ev.detail);
            }
            if (ev instanceof LoadedThreadMessageWindow) {
                onMessageWindowLoaded(ev.detail);
            }
            if (ev instanceof SentThreadMessage) {
                afterSendThreadMessage(threadRootEvent, ev.detail);
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
    }

    async function afterSendMessage(upToDate: boolean) {
        if (upToDate && insideBottomThreshold()) {
            scrollBottom("smooth");
        }
    }

    async function scrollBottom(behavior: ScrollBehavior = "auto", retries = 0) {
        if (retries === 3) return;

        await tick();

        interruptScroll(() => {
            if (messagesDiv) {
                scrollingToMessage = true;
                messagesDiv?.scrollTo({
                    top: messagesDiv.scrollHeight - messagesDiv.clientHeight,
                    behavior,
                });
            }
        });

        if (fromBottom() > 1) {
            await scrollBottom(behavior, retries + 1);
        }
    }

    function shouldLoadPreviousMessages() {
        morePrevAvailable = client.morePreviousMessagesAvailable(chat.chatId, threadRootEvent);
        const result = !loadingPrev && insideTopThreshold() && morePrevAvailable;
        if (result) {
            console.debug("SCROLL: shouldLoadPreviousMessages", keyMeasurements());
        }
        return result;
    }

    function shouldLoadNewMessages() {
        moreNewAvailable = client.moreNewMessagesAvailable(chat.chatId, threadRootEvent);
        const result = !loadingNew && insideBottomThreshold() && moreNewAvailable;
        if (result) {
            console.debug("SCROLL: shouldLoadNewMesages", keyMeasurements());
        }
        return result;
    }

    function loadMoreIfRequired(fromScroll = false, initialLoad = false) {
        if (shouldLoadNewMessages()) {
            loadingNew = true;
            client.loadNewMessages(chat.chatId, threadRootEvent);
            return; // make sure that we don't load previous and new at the same time
        } else {
            loadingNew = false;
        }
        if (shouldLoadPreviousMessages()) {
            loadingPrev = true;
            client.loadPreviousMessages(chat.chatId, threadRootEvent, initialLoad);
        } else {
            loadingPrev = false;
        }
        loadingFromScroll = (loadingNew || loadingPrev) && fromScroll;
    }

    async function resetScroll(initialLoad: boolean) {
        if (focusMessageIndex !== undefined) {
            scrollToMessageIndex(focusMessageIndex, false);
        } else {
            if (initialLoad) {
                await scrollBottom("auto");
            }
        }
        if (!initialised) {
            initialised = true;
        }
    }

    function scrollToMention(mention: Mention | undefined) {
        if (mention !== undefined) {
            scrollToMessageIndex(mention.messageIndex, false);
        }
    }

    function scrollToElement(element: Element | null, behavior: ScrollBehavior = "auto") {
        interruptScroll(() => {
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

    // TODO - need to make this return a promise that *only* resolves once all recursion is complete

    // TODO - confirm whether programmatic scroll causes onScroll to fire and whether it fires synchronously and how many times it fires
    // programmatic scroll included setting scrollTop and / or scroll to bottom and / scroll to element
    export function scrollToMessageIndex(index: number, preserveFocus: boolean) {
        if (index < 0) {
            setFocusMessageIndex(undefined);
            return;
        }

        // set a flag so that we can ignore subsequent scroll events temporarily
        scrollingToMessage = true;
        setFocusMessageIndex(index);
        const element = document.querySelector(`.${rootSelector} [data-index~='${index}']`);
        if (element) {
            // this triggers on scroll which will potentially load some new messages
            scrollToElement(element);
            const msgEvent = findMessageEvent(index);
            if (msgEvent && threadRootEvent === undefined) {
                if (msgEvent.event.thread !== undefined && $pathParams.open) {
                    client.openThread(msgEvent, false);
                } else {
                    client.closeThread();
                }
            }
            if (!preserveFocus) {
                setTimeout(() => {
                    setFocusMessageIndex(undefined);
                }, 200);
            }
        } else {
            client.loadEventWindow(chat.chatId, index, threadRootEvent);
        }
    }

    export async function onMessageWindowLoaded(messageIndex: number | undefined) {
        if (messageIndex === undefined) return;
        await tick();
        initialised = true;
        if (scrollToBottomAfterLoad) {
            loadIndexThenScrollToBottom(messageIndex);
        } else {
            scrollToMessageIndex(messageIndex, false);
            await tick();
            loadMoreIfRequired();
        }
    }

    // is there some way to tell that we will have to recurse
    // if the height changes by less than the threshold
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
        loadingPrev = false;
        loadMoreIfRequired(loadingFromScroll, initialLoad);
    }

    function onLoadedNewMessages(newLatestMessage: boolean) {
        if (newLatestMessage && insideBottomThreshold()) {
            // only scroll if we are now within threshold from the bottom
            scrollBottom("smooth");
        }

        loadingNew = false;
        loadMoreIfRequired(loadingFromScroll);
    }

    // this *looks* crazy - but the idea is that before we programmatically scroll the messages div
    // we set the overflow to hidden. This has the effect of immediately halting any momentum scrolling
    // on iOS which prevents the screen going black.
    function interruptScroll(fn: () => void): void {
        interrupt = true;
        fn();
        window.setTimeout(() => (interrupt = false), 10);
    }

    function onScroll() {
        if (!initialised || loadingPrev || scrollToBottomAfterLoad) return;

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

        if (loadingFromScroll) return;

        loadMoreIfRequired(true);
    }

    async function loadIndexThenScrollToBottom(messageIndex: number) {
        const element = document.querySelector(`.${rootSelector} [data-index~='${messageIndex}']`);
        if (element) {
            await scrollBottom();
            scrollToBottomAfterLoad = false;
            // TODO - we probably need a load more if required here
        } else {
            scrollToBottomAfterLoad = true;
            client.loadEventWindow(chat.chatId, messageIndex, threadRootEvent);
        }
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
    on:scroll={onScroll}
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
        {#if loadingFromScroll}
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
