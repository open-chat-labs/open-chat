<svelte:options immutable />

<script lang="ts">
    import {
        type RehydratedReplyContext,
        OpenChat,
        routeForChatIdentifier,
        chatIdentifiersEqual,
        type ChatIdentifier,
        currentUser,
        chatListScopeStore as chatListScope,
        currentCommunityMembers as communityMembers,
    } from "openchat-client";
    import { rtlStore } from "../../stores/rtl";
    import Link from "../Link.svelte";
    import { _ } from "svelte-i18n";
    import ChatMessageContent from "./ChatMessageContent.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    const dispatch = createEventDispatcher();
    import page from "page";

    const client = getContext<OpenChat>("client");

    export let chatId: ChatIdentifier;
    export let repliesTo: RehydratedReplyContext;
    export let readonly: boolean;
    export let intersecting: boolean;

    let debug = false;

    $: me = repliesTo.senderId === $currentUser.userId;
    $: isTextContent = repliesTo.content?.kind === "text_content";
    $: isP2PSwap = repliesTo.content.kind === "p2p_swap_content";
    $: displayName = me
        ? client.toTitleCase($_("you"))
        : client.getDisplayNameById(repliesTo.senderId, $communityMembers);

    function getUrl() {
        const path = [
            routeForChatIdentifier($chatListScope.kind, repliesTo.sourceContext.chatId),
            repliesTo.sourceContext.threadRootMessageIndex ?? repliesTo.messageIndex,
        ];
        if (repliesTo.sourceContext.threadRootMessageIndex !== undefined) {
            path.push(repliesTo.messageIndex);
        }
        return path.join("/");
    }

    function zoomToMessage() {
        if (chatIdentifiersEqual(repliesTo.sourceContext.chatId, chatId)) {
            dispatch("goToMessageIndex", {
                index: repliesTo.messageIndex,
            });
        } else {
            page(getUrl());
        }
    }
</script>

<Link on:click={zoomToMessage}>
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
                    myUserId={$currentUser.userId}
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
            width: 350px;
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
