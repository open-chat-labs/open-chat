<script lang="ts">
    import type {
        ChatSummary,
        EventWrapper,
        Mention,
        Message,
        MessageContext,
    } from "openchat-client";
    import { iconSize } from "openchat-client";
    import { type Snippet } from "svelte";
    import { _ } from "svelte-i18n";
    import ArrowDown from "svelte-material-icons/ArrowDown.svelte";
    import ArrowUp from "svelte-material-icons/ArrowUp.svelte";
    import SharedChatEventList, {
        type ChatEventListArgs,
    } from "@shared_components/ChatEventList.svelte";
    import type { FlatChatItem } from "@shared_components/flatChatItems";
    import { rtlStore } from "../../stores/rtl";
    import { pop } from "../../utils/transition";
    import Fab from "../Fab.svelte";
    import TimelineDate from "./TimelineDate.svelte";

    interface Props {
        rootSelector: string;
        unreadMessages: number;
        chat: ChatSummary;
        messagesDiv: HTMLDivElement | undefined;
        messagesDivHeight: number;
        initialised: boolean;
        items: FlatChatItem[];
        readonly: boolean;
        firstUnreadMention: Mention | undefined;
        footer: boolean;
        threadRootEvent: EventWrapper<Message> | undefined;
        maintainScroll: boolean;
        scrollTopButtonEnabled?: boolean;
        row: Snippet<[FlatChatItem, ChatEventListArgs]>;
        visible: boolean;
    }

    let {
        rootSelector,
        unreadMessages,
        chat,
        messagesDiv = $bindable(),
        messagesDivHeight = $bindable(),
        initialised = $bindable(),
        items,
        readonly,
        firstUnreadMention,
        footer,
        threadRootEvent,
        maintainScroll,
        scrollTopButtonEnabled = false,
        row,
        visible,
    }: Props = $props();

    let list: SharedChatEventList | undefined = $state();
    let stickyDateEl: HTMLElement | undefined = $state();
    let stickyDateElTop = $derived(stickyDateEl?.getBoundingClientRect()?.top);
    let stickyDateTimestamp = $state<bigint | undefined>(undefined);

    export function scrollToMessageIndex(
        context: MessageContext,
        index: number,
        preserveFocus: boolean,
    ): Promise<void> {
        return list?.scrollToMessageIndex(context, index, preserveFocus) ?? Promise.resolve();
    }

    export function onMessageWindowLoaded(args: {
        context: MessageContext;
        messageIndex: number | undefined;
        initialLoad: boolean;
    }): Promise<void> {
        return list?.onMessageWindowLoaded(args) ?? Promise.resolve();
    }
</script>

<div class="sticky-date" bind:this={stickyDateEl}>
    {#if stickyDateTimestamp !== undefined}
        <TimelineDate timestamp={stickyDateTimestamp} />
    {/if}
</div>

<SharedChatEventList
    bind:this={list}
    {rootSelector}
    {chat}
    {threadRootEvent}
    {items}
    {readonly}
    {maintainScroll}
    {visible}
    bind:initialised
    bind:messagesDiv
    bind:messagesDivHeight
    viewportClass={"desktop-event-list"}
    {stickyDateElTop}
    bind:stickyDateTimestamp
    {row}>
    {#snippet fabs({
        showGoToTop,
        showGoToBottom,
        loadingFromUserScroll,
        scrollToTop,
        scrollToLast,
        scrollToMention,
    })}
        {#if scrollTopButtonEnabled}
            <div
                title={$_("scrollToTop")}
                class:show={showGoToTop}
                class="fab to-top"
                class:rtl={$rtlStore}>
                <Fab on:click={scrollToTop}>
                    <ArrowUp size={$iconSize} color={"#fff"} />
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
                        <div class="unread-count">
                            {unreadMessages > 999 ? "999+" : unreadMessages}
                        </div>
                    </div>
                {:else}
                    <ArrowDown size={$iconSize} color={"#fff"} />
                {/if}
            </Fab>
        </div>
    {/snippet}
</SharedChatEventList>

<style lang="scss">
    :global(.vcl-viewport.desktop-event-list) {
        @include message-list();
        background-color: var(--currentChat-msgs-bg);
    }

    .sticky-date {
        position: absolute;
        top: 90px;
        left: 50%;
        transform: translateX(calc(-50% - 3px));
        @include z-index("date-label");
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
