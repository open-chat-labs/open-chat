<svelte:options immutable={true} />

<script lang="ts">
    import {
        RehydratedReplyContext,
        OpenChat,
        ChatIdentifier,
        routeForChatIdentifier,
        chatIdentifiersEqual,
    } from "openchat-client";
    import { rtlStore } from "../../stores/rtl";
    import Link from "../Link.svelte";
    import { _ } from "svelte-i18n";
    import ChatMessageContent from "./ChatMessageContent.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    const dispatch = createEventDispatcher();
    import page from "page";

    const client = getContext<OpenChat>("client");
    const currentUser = client.user;

    export let messageId: bigint;
    export let chatId: ChatIdentifier;
    export let repliesTo: RehydratedReplyContext;
    export let readonly: boolean;

    let debug = false;
    $: userStore = client.userStore;
    $: chatListScope = client.chatListScope;
    $: me = repliesTo.senderId === currentUser.userId;
    $: isTextContent = repliesTo.content?.kind === "text_content";

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
                messageId,
                index: repliesTo.messageIndex,
            });
        } else {
            page(getUrl());
        }
    }

    function getUsernameFromReplyContext(replyContext: RehydratedReplyContext): string {
        return me
            ? client.toTitleCase($_("you"))
            : $userStore[replyContext.senderId]?.username ?? $_("unknownUser");
    }
</script>

<Link on:click={zoomToMessage}>
    <div
        class="reply-wrapper"
        class:me
        class:rtl={$rtlStore}
        class:crypto={repliesTo.content.kind === "crypto_content"}>
        <h4 class="username" class:text-content={isTextContent}>
            {getUsernameFromReplyContext(repliesTo)}
        </h4>
        {#if repliesTo.content !== undefined}
            <ChatMessageContent
                {me}
                {readonly}
                {chatId}
                messageId={repliesTo.messageId}
                messageIndex={repliesTo.messageIndex}
                senderId={repliesTo.senderId}
                edited={repliesTo.edited}
                fill={false}
                reply={true}
                myUserId={currentUser.userId}
                content={repliesTo.content} />
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
        border: 2px solid var(--bd);
        cursor: pointer;
        margin-bottom: $sp3;
        overflow: hidden;

        &.me {
            background-color: var(--currentChat-msg-me-bg);
            border: 2px solid var(--currentChat-msg-me-bd);
            color: var(--currentChat-msg-me-txt);
        }

        &:after {
            content: "";
            display: table;
            clear: both;
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
