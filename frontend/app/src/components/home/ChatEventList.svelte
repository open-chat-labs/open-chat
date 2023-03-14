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
    import { derived, writable } from "svelte/store";
    import { dimensions, mobileWidth } from "../../stores/screenDimensions";
    import { isSafari } from "../../utils/devices";

    const FROM_BOTTOM_THRESHOLD = 600;
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
    let expectedScrollTop: number | undefined = undefined;
    let scrollingToMessage = false;
    let scrollTimer: number | undefined;
    let previousScrollHeight: number | undefined = undefined;
    let previousScrollTop: number | undefined = undefined;
    let user = client.user;

    $: failedMessagesStore = client.failedMessagesStore;
    $: threadSummary = threadRootEvent?.event.thread;
    $: mobileSafari = $mobileWidth && isSafari;
    // $: mobileSafari = true;

    const scrollTop = writable<number>(0);
    const fromBottom = derived(scrollTop, ($scrollTop) => -$scrollTop);
    const insideBottomThreshold = derived(
        [fromBottom, dimensions],
        ([$fromBottom, $dimensions]) => {
            return $fromBottom < $dimensions.height;
        }
    );
    const showGoToBottom = derived(fromBottom, ($fromBottom) => {
        return $fromBottom < FROM_BOTTOM_THRESHOLD;
    });

    beforeUpdate(() => {
        previousScrollHeight = messagesDiv?.scrollHeight;
        previousScrollTop = messagesDiv?.scrollTop;
    });

    afterUpdate(() => {
        $scrollTop = messagesDiv?.scrollTop ?? 0;
        morePrevAvailable = client.morePreviousMessagesAvailable(chat.chatId, threadRootEvent);
        moreNewAvailable = client.moreNewMessagesAvailable(chat.chatId, threadRootEvent);
    });

    onMount(() => {
        morePrevAvailable = client.morePreviousMessagesAvailable(chat.chatId, threadRootEvent);
        moreNewAvailable = client.moreNewMessagesAvailable(chat.chatId, threadRootEvent);
        client.addEventListener("openchat_event", clientEvent);
        return () => {
            client.removeEventListener("openchat_event", clientEvent);
        };
    });

    function calculateFromTop(): number {
        return messagesDiv
            ? messagesDiv.scrollHeight - messagesDiv.clientHeight + messagesDiv.scrollTop
            : 0;
    }

    function clientEvent(ev: Event): void {
        tick().then(() => {
            if (threadRootEvent === undefined) {
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
            if (threadRootEvent !== undefined) {
                if (ev instanceof LoadedNewThreadMessages) {
                    onLoadedNewMessages(ev.detail);
                }
                if (ev instanceof LoadedPreviousThreadMessages) {
                    onLoadedPreviousMessages();
                }
                if (ev instanceof LoadedThreadMessageWindow) {
                    console.log("Thread message window loaded: ", events);
                    onMessageWindowLoaded(ev.detail);
                }
                if (ev instanceof SentThreadMessage) {
                    afterSendThreadMessage(threadRootEvent, ev.detail);
                }
            }
        });
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

    function afterSendMessage(upToDate: boolean) {
        if (upToDate && $insideBottomThreshold) {
            tick().then(() => scrollBottom("smooth"));
        }
    }

    function scrollBottom(behavior: ScrollBehavior = "auto") {
        interruptScroll(() => {
            messagesDiv?.scrollTo({
                top: 0,
                behavior,
            });
        });
    }

    function shouldLoadPreviousMessages() {
        morePrevAvailable = client.morePreviousMessagesAvailable(chat.chatId, threadRootEvent);
        const insideLoadThreshold = calculateFromTop() < $dimensions.height;
        const result = !loadingPrev && insideLoadThreshold && morePrevAvailable;
        if (result) {
            console.debug(
                "SCROLL: shouldLoadPreviousMessages [loadingPrev] [insideLoadThreshold] [morePrevAvailable]",
                loadingPrev,
                insideLoadThreshold,
                morePrevAvailable
            );
        }
        return result;
    }

    function shouldLoadNewMessages() {
        moreNewAvailable = client.moreNewMessagesAvailable(chat.chatId, threadRootEvent);
        const result = !loadingNew && $insideBottomThreshold && moreNewAvailable;
        if (result) {
            console.debug(
                "SCROLL: shouldLoadNewMesages [loadingNew] [insideLoadThreshold] [moreNewMessages]",
                loadingNew,
                $insideBottomThreshold,
                moreNewAvailable
            );
        }
        return result;
    }

    // this is used when we load new messages explicitly on request
    function loadNewMessages() {
        loadingNew = true;
        loadingFromScroll = true;
        previousScrollHeight = messagesDiv?.scrollHeight;
        previousScrollTop = messagesDiv?.scrollTop;
        client.loadNewMessages(chat.chatId, threadRootEvent);
    }

    function loadMoreIfRequired(fromScroll = false) {
        if (shouldLoadNewMessages() && !mobileSafari) {
            loadingNew = true;
            console.debug(
                "SCROLL: about to load new messages",
                messagesDiv?.scrollTop,
                messagesDiv?.scrollHeight
            );
            client.loadNewMessages(chat.chatId, threadRootEvent);
        } else {
            loadingNew = false;
        }
        if (shouldLoadPreviousMessages()) {
            loadingPrev = true;
            console.debug("SCROLL: about to load previous messages");
            client.loadPreviousMessages(chat.chatId, threadRootEvent);
        } else {
            loadingPrev = false;
        }
        loadingFromScroll = (loadingNew || loadingPrev) && fromScroll;
    }

    function resetScroll() {
        if (focusMessageIndex !== undefined) {
            scrollToMessageIndex(focusMessageIndex, false);
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
                !failedMessagesStore.contains(selectedThreadKey ?? chat.chatId, ev.event.messageId) //TODO threads
        ) as EventWrapper<Message> | undefined;
    }

    export function scrollToMessageIndex(
        index: number,
        preserveFocus: boolean,
        loadWindowIfMissing: boolean = true
    ) {
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
        } else if (loadWindowIfMissing) {
            client.loadEventWindow(chat.chatId, index, threadRootEvent);
        }
    }

    export function adjust(scrollHeight: number, scrollTop: number) {
        const diff = (messagesDiv?.scrollHeight ?? 0) - scrollHeight;
        interruptScroll(() => {
            messagesDiv?.scrollTo({ top: scrollTop - diff, behavior: "auto" });
        });
    }

    export function onMessageWindowLoaded(messageIndex: number | undefined) {
        if (messageIndex === undefined) return;
        tick()
            .then(() => (initialised = true))
            .then(() => {
                expectedScrollTop = undefined;
                scrollToMessageIndex(messageIndex, false, true);
            })
            .then(tick)
            .then(() => loadMoreIfRequired());
    }

    function onLoadedPreviousMessages() {
        console.debug("SCROLL: loaded previous messages");
        tick()
            .then(() => (initialised = true))
            .then(resetScroll) // TODO why?
            .then(() => {
                expectedScrollTop = messagesDiv?.scrollTop ?? 0;
            })
            .then(() => loadMoreIfRequired());
    }

    function onLoadedNewMessages(newLatestMessage: boolean) {
        if (
            loadingFromScroll &&
            $insideBottomThreshold &&
            previousScrollHeight !== undefined &&
            previousScrollTop !== undefined &&
            messagesDiv !== undefined
        ) {
            const scrollHeightDiff = messagesDiv.scrollHeight - previousScrollHeight;
            const scrollTopDiff = Math.abs(messagesDiv.scrollTop - previousScrollTop);

            if (scrollHeightDiff !== scrollTopDiff) {
                // if the height did not change by the same amount as the scroll position then we need to take matters into our own hands
                // - looking at YOU iOS and Firefox
                interruptScroll(() => {
                    if (messagesDiv !== undefined) {
                        $scrollTop = messagesDiv.scrollTop =
                            messagesDiv.scrollTop - scrollHeightDiff;
                        console.debug("SCROLL: scrollTop updated to " + messagesDiv.scrollTop);
                    }
                });
            }
        } else if (newLatestMessage && $insideBottomThreshold) {
            // only scroll if we are now within threshold from the bottom
            scrollBottom("smooth");
        }

        loadMoreIfRequired(loadingFromScroll);
    }

    function scrollLeapDetected() {
        return (
            expectedScrollTop !== undefined &&
            expectedScrollTop - (messagesDiv?.scrollTop ?? 0) > 500
        );
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
        if (!initialised) return;

        $scrollTop = messagesDiv?.scrollTop ?? 0;

        if (scrollLeapDetected()) {
            console.debug("SCROLL: position has leapt unacceptably", messagesDiv?.scrollTop);
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

        if (loadingFromScroll) return;

        loadMoreIfRequired(true);
    }

    function scrollToLast() {
        if (threadSummary !== undefined) {
            scrollToMessageIndex(threadSummary.numberOfReplies - 1, false);
        } else {
            scrollToMessageIndex(chat.latestMessage?.event.messageIndex ?? -1, false);
        }
    }
</script>

<div
    bind:this={messagesDiv}
    bind:clientHeight={messagesDivHeight}
    on:scroll={onScroll}
    class:interrupt
    class={`scrollable-list ${rootSelector}`}>
    {#if mobileSafari && initialised && moreNewAvailable}
        <div class:loading={loadingNew} on:click={loadNewMessages} class="more">
            {#if !loadingNew}
                <span>
                    {$_("loadMore")}
                </span>
            {/if}
        </div>
    {/if}
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
    class:show={!$showGoToBottom || unreadMessages > 0}
    class="fab to-bottom"
    class:footer
    class:rtl={$rtlStore}>
    <Fab on:click={scrollToLast}>
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
    .scrollable-list {
        @include message-list();
        background-color: var(--currentChat-msgs-bg);

        &.interrupt {
            overflow-y: hidden;
        }
    }

    .more {
        flex: 0 0 toRem(80);
        cursor: pointer;
        display: grid;
        align-content: center;
        background-color: rgba(255, 255, 255, 0.05);
        @include font(bold, normal, fs-100);
        text-align: center;

        &.loading {
            background-color: transparent;
            @include loading-spinner();
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
