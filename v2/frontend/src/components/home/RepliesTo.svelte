<svelte:options immutable={true} />

<script lang="ts">
    import type { ReplyContext } from "../../domain/chat/chat";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import { rtlStore } from "../../stores/rtl";
    import type { ActorRefFrom } from "xstate";
    import Link from "../Link.svelte";
    import { _ } from "svelte-i18n";
    import { getContentAsText } from "../../domain/chat/chat.utils";

    export let machine: ActorRefFrom<ChatMachine>;
    export let repliesTo: ReplyContext;

    function sentByMe(replyContext: ReplyContext): boolean {
        return replyContext.kind === "direct_standard_reply_context" && replyContext.sentByMe;
    }

    function zoomToMessage() {
        if (repliesTo.kind === "direct_standard_reply_context") {
            // how to get trigger a scroll *after* the effects of this event are complete
            machine.send({ type: "GO_TO_MESSAGE_INDEX", data: repliesTo.messageIndex });
        }

        if (repliesTo.kind === "direct_private_reply_context") {
            console.log("select chat: ", repliesTo.chatId);
            console.log("and then zoom to message: ", repliesTo.messageIndex);
        }

        if (repliesTo.kind === "group_reply_context") {
            // we don't have a messageIndex in this scenario - need to double check why that is
            console.log("group chat reply clicked");
        }
    }

    function getMessageIndex(replyContext: ReplyContext): number {
        if (replyContext.kind === "group_reply_context") return 0;
        return replyContext.messageIndex;
    }

    function getUsernameFromReplyContext(replyContext: ReplyContext): string {
        if (replyContext.kind === "direct_standard_reply_context") {
            if (replyContext.sentByMe) {
                return $machine.context.user!.username;
            } else {
                if ($machine.context.chatSummary.kind === "direct_chat") {
                    return (
                        $machine.context.userLookup[$machine.context.chatSummary.them]?.username ??
                        $_("unknownUser")
                    );
                }
            }
        }
        return "todo - someone else";
    }
</script>

<Link on:click={zoomToMessage}>
    <div class="reply-wrapper" class:me={sentByMe(repliesTo)} class:rtl={$rtlStore}>
        <h4 class="username">
            {getUsernameFromReplyContext(repliesTo)} ({getMessageIndex(repliesTo)})
        </h4>
        {#if repliesTo.kind === "direct_standard_reply_context"}
            {getContentAsText(repliesTo.content)}
        {/if}
    </div>
</Link>

<style type="text/scss">
    .reply-wrapper {
        border-radius: $sp3;
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
