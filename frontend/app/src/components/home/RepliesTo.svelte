<svelte:options immutable={true} />

<script lang="ts">
    import type { RehydratedReplyContext, OpenChat } from "openchat-client";
    import { rtlStore } from "../../stores/rtl";
    import Link from "../Link.svelte";
    import { _ } from "svelte-i18n";
    import ChatMessageContent from "./ChatMessageContent.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    const dispatch = createEventDispatcher();
    import { push } from "svelte-spa-router";
    import { messageIsVisible } from "openchat-shared";

    const client = getContext<OpenChat>("client");
    const currentUser = client.user;

    export let messageId: bigint;
    export let chatId: string;
    export let repliesTo: RehydratedReplyContext;
    export let preview: boolean;
    export let groupChat: boolean;

    let debug = false;

    $: userStore = client.userStore;
    $: hideDeletedStore = client.hideDeletedStore;
    $: me = repliesTo.senderId === currentUser.userId;
    $: isTextContent = repliesTo.content?.kind === "text_content";
    $: replyIsVisible = messageIsVisible(
        $hideDeletedStore, 
        repliesTo.content, 
        repliesTo.senderId, 
        repliesTo.threadRoot, 
        currentUser.userId);

    function zoomToMessage() {
        if (!replyIsVisible) {
            return;
        }

        if (repliesTo.chatId === chatId) {
            dispatch("goToMessageIndex", {
                messageId,
                index: repliesTo.messageIndex,
            });
        } else {
            push(`/${repliesTo.chatId}/${repliesTo.messageIndex}`);
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
        class:unclickable={!replyIsVisible}
        class:crypto={repliesTo.content.kind === "crypto_content"}>
        <h4 class="username" class:text-content={isTextContent}>
            {getUsernameFromReplyContext(repliesTo)}
        </h4>
        {#if repliesTo.content !== undefined}
            <ChatMessageContent
                {me}
                {preview}
                {groupChat}
                {chatId}
                first={true}
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

<style type="text/scss">
    :global(.reply-wrapper.me a) {
        color: inherit;
    }

    .reply-wrapper {
        border-radius: $sp4;
        padding: $sp3;
        background-color: var(--currentChat-msg-bg);
        color: var(--currentChat-msg-txt);
        box-shadow: -7px 0px 0px 0px var(--currentChat-msg-reply-accent);
        border: 2px solid var(--currentChat-msg-reply-accent);
        margin-bottom: $sp3;
        margin-left: 7px;
        overflow: hidden;

        &.unclickable {
            cursor: default;
        }

        &.rtl {
            box-shadow: 7px 0px 0px 0px var(--currentChat-msg-reply-accent);
            margin-left: 0;
            margin-right: 7px;
        }

        &.me {
            background-color: var(--currentChat-msg-me-hv);
            color: var(--currentChat-msg-me-txt);
        }

        &.crypto {
            @include gold();
        }

        &:after {
            content: "";
            display: table;
            clear: both;
        }
    }

    .username {
        margin: 0;
        margin-bottom: $sp2;
        display: inline;
        @include font(bold, normal, fs-100);

        &.text-content {
            display: block;
        }
    }
</style>
