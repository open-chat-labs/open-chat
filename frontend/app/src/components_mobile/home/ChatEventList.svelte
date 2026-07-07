<script lang="ts">
    import { FloatingButton } from "component-lib";
    import type {
        ChatSummary,
        EventWrapper,
        Mention,
        Message,
        MessageContext,
    } from "openchat-client";
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
        // footer,
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
    viewportClass={"mobile-event-list"}
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
        <div class="fab_wrapper" class:rtl={$rtlStore}>
            {#if scrollTopButtonEnabled}
                <div title={$_("scrollToTop")} class:show={showGoToTop} class="fab to-top">
                    <FloatingButton variant="secondary" onClick={scrollToTop}>
                        {#snippet icon(color)}
                            <ArrowUp {color} />
                        {/snippet}
                    </FloatingButton>
                </div>
            {/if}

            {#if !readonly}
                <div
                    title={$_("goToFirstMention")}
                    class:show={firstUnreadMention !== undefined}
                    class="fab mentions">
                    <FloatingButton
                        variant="secondary"
                        onClick={() => scrollToMention(firstUnreadMention)}>
                        {#snippet icon()}
                            <div in:pop={{ duration: 1500 }} class="unread">
                                <div class="mention-count">@</div>
                            </div>
                        {/snippet}
                    </FloatingButton>
                </div>
            {/if}
            <div
                title={$_("goToLatestMessage")}
                class:show={showGoToBottom || unreadMessages > 0}
                class="fab to-bottom">
                <FloatingButton variant="secondary" onClick={scrollToLast}>
                    {#snippet icon(color)}
                        {#if loadingFromUserScroll}
                            <div class="spinner"></div>
                        {:else if unreadMessages > 0}
                            <div in:pop={{ duration: 1500 }} class="unread">
                                <div class="unread-count">
                                    {unreadMessages > 999 ? "999+" : unreadMessages}
                                </div>
                            </div>
                        {:else}
                            <ArrowDown {color} />
                        {/if}
                    {/snippet}
                </FloatingButton>
            </div>
        </div>
    {/snippet}
</SharedChatEventList>

<style lang="scss">
    :global(.vcl-viewport.mobile-event-list) {
        flex: 1 1 0;
        position: relative;
        padding: var(--sp-md) var(--sp-lg) 0 var(--sp-lg);
        gap: var(--sp-xs);
    }

    .sticky-date {
        position: absolute;
        top: 0.375rem;
        left: 50%;
        transform: translateX(-50%);
        @include z-index("date-label");
    }

    .spinner {
        @include loading-spinner(1em, 0.5em, var(--button-spinner), "/assets/plain-spinner.svg");
    }

    .fab_wrapper {
        display: flex;
        flex-direction: column;
        gap: var(--sp-md);
        position: absolute;
        bottom: var(--sp-sm);
        pointer-events: none;

        &:not(.rtl) {
            right: var(--sp-xl);
        }

        &.rtl {
            left: var(--sp-md);
        }
    }

    .fab {
        opacity: 0;
        transition: opacity ease-in-out 300ms;
        pointer-events: none;
        @include z-index("fab");

        &.show {
            opacity: 1;
            pointer-events: all;
        }
    }

    .mentions .mention-count {
        @include font(bold, normal, fs-140);
    }

    .unread {
        color: var(--primary);
    }
</style>
