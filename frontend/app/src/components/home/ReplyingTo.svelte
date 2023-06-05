<script lang="ts">
    import type { EnhancedReplyContext, CreatedUser, OpenChat } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import { createEventDispatcher, getContext } from "svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import ChatMessageContent from "./ChatMessageContent.svelte";
    import { iconSize } from "../../stores/iconSize";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let replyingTo: EnhancedReplyContext;
    export let user: CreatedUser;
    export let readonly: boolean;
    export let chatId: string;

    $: me = replyingTo.sender?.userId === user?.userId;

    $: username = me ? client.toTitleCase($_("you")) : replyingTo.sender?.username ?? "unknownUser";

    function cancelReply() {
        dispatch("cancelReply");
    }
</script>

<div
    class="replying"
    class:me
    class:rtl={$rtlStore}
    class:crypto={replyingTo.content.kind === "crypto_content"}>
    <div class="close-icon" on:click={cancelReply}>
        <HoverIcon compact={true}>
            <Close size={$iconSize} color={me ? "#fff" : "#aaa"} />
        </HoverIcon>
    </div>
    <h4 class="username">
        {username}
    </h4>
    <ChatMessageContent
        {readonly}
        {chatId}
        fill={false}
        {me}
        messageId={replyingTo.messageId}
        messageIndex={replyingTo.messageIndex}
        senderId={replyingTo.senderId}
        truncate={true}
        edited={replyingTo.edited}
        content={replyingTo.content}
        myUserId={user.userId}
        reply={true} />
</div>

<style lang="scss">
    :global(.replying.me a) {
        color: inherit;
    }

    .replying {
        @include font(book, normal, fs-100);
        margin-top: $sp4;
        min-width: 120px;
        border-radius: $sp4;
        padding: $sp3;
        background-color: var(--currentChat-msg-bg);
        color: var(--currentChat-msg-txt);
        position: relative;

        .close-icon {
            position: absolute;
            top: $sp2;
            right: $sp2;
        }

        &.rtl {
            .close-icon {
                right: unset;
                left: $sp2;
            }
        }

        &.me {
            background-color: var(--currentChat-msg-me-bg);
            color: #ffffff;
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
    }
</style>
