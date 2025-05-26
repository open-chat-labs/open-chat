<script lang="ts">
    import {
        type ChatIdentifier,
        type RehydratedReplyContext,
        chatIdentifiersEqual,
        chatListScopeStore,
        currentUserIdStore,
        OpenChat,
        routeForChatIdentifier,
        selectedCommunityMembersStore,
    } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import Link from "../Link.svelte";
    import ChatMessageContent from "./ChatMessageContent.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chatId: ChatIdentifier;
        repliesTo: RehydratedReplyContext;
        readonly: boolean;
        intersecting: boolean;
        onGoToMessageIndex?: (args: { index: number }) => void;
        onRemovePreview?: (url: string) => void;
    }

    let { chatId, repliesTo, readonly, intersecting, onGoToMessageIndex, onRemovePreview }: Props =
        $props();

    let debug = false;

    let me = $derived(repliesTo.senderId === $currentUserIdStore);
    let isTextContent = $derived(repliesTo.content?.kind === "text_content");
    let isP2PSwap = $derived(repliesTo.content.kind === "p2p_swap_content");
    let displayName = $derived(
        me
            ? client.toTitleCase($_("you"))
            : client.getDisplayNameById(repliesTo.senderId, $selectedCommunityMembersStore),
    );

    function getUrl() {
        const path = [
            routeForChatIdentifier($chatListScopeStore.kind, repliesTo.sourceContext.chatId),
            repliesTo.sourceContext.threadRootMessageIndex ?? repliesTo.messageIndex,
        ];
        if (repliesTo.sourceContext.threadRootMessageIndex !== undefined) {
            path.push(repliesTo.messageIndex);
        }
        return path.join("/");
    }

    function zoomToMessage() {
        if (chatIdentifiersEqual(repliesTo.sourceContext.chatId, chatId)) {
            onGoToMessageIndex?.({
                index: repliesTo.messageIndex,
            });
        } else {
            page(getUrl());
        }
    }
</script>

<Link onClick={zoomToMessage}>
    <div
        class="reply-wrapper"
        class:me
        class:rtl={$rtlStore}
        class:p2pSwap={isP2PSwap}
        class:crypto={repliesTo.content.kind === "crypto_content"}>
        <h4 class="username" class:text-content={isTextContent}>
            {displayName}
        </h4>
        {#if repliesTo.content !== undefined}
            <div class="inert">
                <ChatMessageContent
                    {me}
                    {readonly}
                    messageContext={repliesTo.sourceContext}
                    {intersecting}
                    messageId={repliesTo.messageId}
                    messageIndex={repliesTo.messageIndex}
                    senderId={repliesTo.senderId}
                    edited={repliesTo.edited}
                    fill={false}
                    failed={false}
                    blockLevelMarkdown={true}
                    truncate
                    reply
                    {onRemovePreview}
                    content={repliesTo.content} />
            </div>
            {#if debug}
                <pre>EventIdx: {repliesTo.eventIndex}</pre>
                <pre>MsgId: {repliesTo.messageId}</pre>
                <pre>SenderId: {repliesTo.senderId}</pre>
            {/if}
        {:else}
            {"TODO - we don't have the message content for this"}
        {/if}
    </div>
</Link>

<style lang="scss">
    :global(.reply-wrapper.me a) {
        color: inherit;
    }

    .reply-wrapper {
        border-radius: $sp3;
        padding: $sp3;
        background-color: var(--currentChat-msg-bg);
        color: var(--currentChat-msg-txt);
        border: var(--bw) solid var(--replies-bd);
        cursor: pointer;
        margin-bottom: $sp3;
        overflow: hidden;
        @include nice-scrollbar();
        max-height: 300px;

        .inert {
            pointer-events: none;
        }

        &.me {
            background-color: var(--currentChat-msg-me-bg);
            border: var(--bw) solid var(--currentChat-msg-me-bd);
            color: var(--currentChat-msg-me-txt);
        }

        &:after {
            content: "";
            display: table;
            clear: both;
        }

        &.p2pSwap {
            max-width: 350px;
        }
    }

    .username {
        margin: 0;
        margin-bottom: $sp1;
        display: inline;

        &.text-content {
            display: block;
        }
    }
</style>
