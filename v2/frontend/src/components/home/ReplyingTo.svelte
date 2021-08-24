<script lang="ts">
    import type { EnhancedReplyContext, ReplyContext } from "../../domain/chat/chat";
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import { createEventDispatcher } from "svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import ChatMessageContent from "./ChatMessageContent.svelte";
    import type { UserSummary } from "../../domain/user/user";
    import { fade } from "svelte/transition";

    const dispatch = createEventDispatcher();

    export let replyingTo: EnhancedReplyContext<ReplyContext>;
    export let user: UserSummary | undefined;

    $: me = replyingTo.sender?.userId === user?.userId;

    $: username = replyingTo.sender?.username ?? "unknown";

    function cancelReply() {
        dispatch("cancelReply");
    }
</script>

<div in:fade={{ duration: 200 }} class="replying-wrapper" class:rtl={$rtlStore}>
    <div class="replying" class:me class:rtl={$rtlStore}>
        <div class="close-icon" on:click={cancelReply}>
            <HoverIcon>
                <Close size={"1.2em"} color={me ? "#fff" : "#aaa"} />
            </HoverIcon>
        </div>
        <h4 class="username">
            {username}
        </h4>
        <ChatMessageContent {me} truncate={true} content={replyingTo.content} />
    </div>
</div>

<style type="text/scss">
    .replying-wrapper {
        border-radius: $sp4 $sp4 0 0;
        padding: 0 0 0 7px;
        box-shadow: 0 -6px 10px 0 rgba(25, 25, 25, 0.25);

        &.rtl {
            padding: 0 7px 0 0;
        }
    }

    .replying {
        @include font(book, normal, fs-100);
        border-radius: inherit;
        padding: $sp3;
        background-color: var(--currentChat-msg-bg);
        color: var(--currentChat-msg-txt);
        box-shadow: -7px 0px 0px 0px var(--button-bg);
        position: relative;

        .close-icon {
            position: absolute;
            top: $sp2;
            right: $sp2;
        }

        &.rtl {
            box-shadow: 7px 0px 0px 0px var(--button-bg);

            .close-icon {
                right: unset;
                left: $sp2;
            }
        }

        &.me {
            background-color: var(--currentChat-msg-me-hv);
            color: var(--currentChat-msg-me-txt);
            border-color: var(--currentChat-msg-me-bd);
        }
    }

    .username {
        margin: 0;
        margin-bottom: $sp2;
        @include font(bold, normal, fs-100);
    }
</style>
