<svelte:options immutable={true} />

<script lang="ts">
    import type { ReplyContext } from "../../domain/chat/chat";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import type { ActorRefFrom } from "xstate";
    import { getContentAsText } from "../../domain/chat/chat.utils";

    export let machine: ActorRefFrom<ChatMachine>;
    export let repliesTo: ReplyContext;

    function sentByMe(replyContext: ReplyContext): boolean {
        return replyContext.kind === "direct_standard_reply_context" && replyContext.sentByMe;
    }

    function getUsernameFromReplyContext(replyContext: ReplyContext): string {
        if (replyContext.kind === "direct_standard_reply_context") {
            if (replyContext.sentByMe) {
                return "todo - me";
            } else {
                return "todo - you";
            }
        }
        return "todo - someone else";
    }
</script>

<div class="reply-wrapper" class:me={sentByMe(repliesTo)}>
    <h4 class="username">{getUsernameFromReplyContext(repliesTo)}</h4>
    {#if repliesTo.kind === "direct_standard_reply_context"}
        {getContentAsText(repliesTo.content)}
    {/if}
</div>

<style type="text/scss">
    .reply-wrapper {
        border-radius: $sp3;
        padding: $sp3;
        background-color: rgba(255, 255, 255, 0.1);
        margin-bottom: $sp3;
        cursor: pointer;

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
