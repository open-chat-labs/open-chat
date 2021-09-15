<svelte:options immutable={true} />

<script lang="ts">
    import type { ChatSummary, MessageContent, ReplyContext } from "../../domain/chat/chat";
    import { rtlStore } from "../../stores/rtl";
    import Link from "../Link.svelte";
    import { _ } from "svelte-i18n";
    import ChatMessageContent from "./ChatMessageContent.svelte";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();
    import { push } from "svelte-spa-router";
    import type { UserLookup, UserSummary } from "../../domain/user/user";
    import type { Identity } from "@dfinity/agent";

    export let chatSummary: ChatSummary;
    export let user: UserSummary | undefined;
    export let userLookup: UserLookup;
    export let repliesTo: ReplyContext;
    export let identity: Identity;

    function sentByMe(replyContext: ReplyContext): boolean {
        return replyContext.kind === "direct_standard_reply_context" && replyContext.sentByMe;
    }

    function zoomToMessage() {
        if (repliesTo.kind === "direct_standard_reply_context") {
            dispatch("goToMessage", repliesTo.eventIndex);
        }

        if (repliesTo.kind === "direct_private_reply_context") {
            push(`/${repliesTo.chatId}/${repliesTo.eventIndex}`);
        }

        if (repliesTo.kind === "group_reply_context") {
            dispatch("goToMessage", repliesTo.eventIndex);
        }
    }

    function messageContentFromReplyContent(
        replyContext: ReplyContext
    ): MessageContent | undefined {
        return replyContext.kind === "direct_private_reply_context"
            ? undefined
            : replyContext.content;
    }

    function getUsernameFromReplyContext(replyContext: ReplyContext): string {
        if (replyContext.kind === "direct_standard_reply_context") {
            if (replyContext.sentByMe) {
                return user!.username;
            } else {
                if (chatSummary.kind === "direct_chat") {
                    return userLookup[chatSummary.them]?.username ?? $_("unknownUser");
                }
            }
        }
        if (replyContext.kind === "group_reply_context") {
            return userLookup[replyContext.userId]?.username ?? $_("unknownUser");
        }
        // for the private reply context - we do not currently have the message content or the userId - we need them both
        return "todo - someone else";
    }

    $: content = messageContentFromReplyContent(repliesTo);
</script>

<Link on:click={zoomToMessage}>
    <div class="reply-wrapper" class:me={sentByMe(repliesTo)} class:rtl={$rtlStore}>
        <h4 class="username">
            {getUsernameFromReplyContext(repliesTo)} ({repliesTo.eventIndex})
        </h4>
        {#if content !== undefined}
            <ChatMessageContent {identity} {content} />
        {/if}
        {#if repliesTo.kind === "direct_private_reply_context"}
            {`Private reply to message from chatId ${repliesTo.chatId}`}
        {/if}
    </div>
</Link>

<style type="text/scss">
    .reply-wrapper {
        border-radius: $sp4;
        padding: $sp3;
        background-color: var(--currentChat-msg-bg);
        color: var(--currentChat-msg-txt);
        cursor: pointer;
        box-shadow: -7px 0px 0px 0px var(--button-bg);
        border: 1px solid var(--button-bg);
        margin-bottom: $sp3;

        &.rtl {
            box-shadow: 7px 0px 0px 0px var(--button-bg);
        }

        &.me {
            background-color: var(--currentChat-msg-me-hv);
            color: var(--currentChat-msg-me-txt);
            border-color: var(--currentChat-msg-me-bd);
            &:hover {
                background-color: var(--currentChat-msg-me-bg);
            }
        }
    }

    .username {
        margin: 0;
        margin-bottom: $sp2;
        @include font(bold, normal, fs-100);
    }
</style>
