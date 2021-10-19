<svelte:options immutable={true} />

<script lang="ts">
    import type { RehydratedReplyContext } from "../../domain/chat/chat";
    import { rtlStore } from "../../stores/rtl";
    import Link from "../Link.svelte";
    import { _ } from "svelte-i18n";
    import ChatMessageContent from "./ChatMessageContent.svelte";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();
    import { push } from "svelte-spa-router";
    import type { UserSummary } from "../../domain/user/user";
    import { userStore } from "../../stores/user";

    export let chatId: string;
    export let user: UserSummary | undefined;
    export let repliesTo: RehydratedReplyContext;

    let debug = false;

    $: me = repliesTo.senderId === user?.userId;

    function zoomToMessage() {
        if (repliesTo.chatId === chatId) {
            dispatch("goToMessageIndex", repliesTo.messageIndex);
        } else {
            push(`/${repliesTo.chatId}/${repliesTo.messageIndex}`);
        }
    }

    function getUsernameFromReplyContext(replyContext: RehydratedReplyContext): string {
        return $userStore[replyContext.senderId]?.username ?? $_("unknownUser");
    }
</script>

<Link on:click={zoomToMessage}>
    <div class="reply-wrapper" class:me class:rtl={$rtlStore}>
        <h4 class="username">
            {getUsernameFromReplyContext(repliesTo)}
        </h4>
        {#if repliesTo.content !== undefined}
            <ChatMessageContent content={repliesTo.content} />
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
