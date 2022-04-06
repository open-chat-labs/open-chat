<script lang="ts">
    import type { EnhancedReplyContext } from "../../domain/chat/chat";
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import { createEventDispatcher } from "svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import ChatMessageContent from "./ChatMessageContent.svelte";
    import type { UserSummary } from "../../domain/user/user";
    import { iconSize } from "../../stores/iconSize";
    import { toTitleCase } from "../../utils/string";

    const dispatch = createEventDispatcher();

    export let replyingTo: EnhancedReplyContext;
    export let user: UserSummary;
    export let preview: boolean;
    export let groupChat: boolean;

    $: me = replyingTo.sender?.userId === user?.userId;

    $: username = me ? toTitleCase($_("you")) : replyingTo.sender?.username ?? "unknownUser";

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
        {preview}
        {groupChat}
        fill={false}
        first={true}
        {me}
        senderId={replyingTo.senderId}
        truncate={true}
        content={replyingTo.content}
        reply={true} />
</div>

<style type="text/scss">
    .replying {
        @include font(book, normal, fs-100);
        margin-top: $sp4;
        margin-left: 7px;
        min-width: 120px;
        border-radius: $sp4;
        padding: $sp3;
        background-color: var(--currentChat-msg-bg);
        color: var(--currentChat-msg-txt);
        box-shadow: -7px 0px 0px 0px var(--currentChat-msg-reply-accent);
        border: 2px solid var(--currentChat-msg-reply-accent);
        position: relative;

        .close-icon {
            position: absolute;
            top: $sp2;
            right: $sp2;
        }

        &.rtl {
            box-shadow: 7px 0px 0px 0px var(--button-bg);
            margin-left: 0;
            margin-right: 7px;

            .close-icon {
                right: unset;
                left: $sp2;
            }
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
        @include font(bold, normal, fs-100);
    }
</style>
