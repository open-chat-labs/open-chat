<svelte:options immutable={true} />

<script lang="ts">
    import Link from "../../Link.svelte";
    import type { CreatedUser, Message, OpenChat } from "openchat-client";
    import ChatMessageContent from "../ChatMessageContent.svelte";
    import RepliesTo from "../RepliesTo.svelte";
    import UnresolvedReply from "../UnresolvedReply.svelte";
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../../stores/rtl";
    import { createEventDispatcher, getContext } from "svelte";
    import ViewUserProfile from "../profile/ViewUserProfile.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let chatId: string;
    export let user: CreatedUser;
    export let senderId: string;
    export let msg: Message;

    let viewProfile = false;
    let usernameLink: Link;
    let usernameLinkBoundingRect: DOMRect | undefined = undefined;
    let crypto = msg.content.kind === "crypto_content";

    $: sender = $userStore[senderId];
    $: username = sender?.username;
    $: userStore = client.userStore;
    $: deleted = msg.content.kind === "deleted_content";
    $: fill = client.fillMessage(msg);
    $: me = user.userId === senderId;

    function chatWithUser() {
        closeUserProfile();
        dispatch("chatWith", senderId);
    }

    function openUserProfile(e: Event) {
        usernameLinkBoundingRect = usernameLink.getBoundingRect();
        viewProfile = true;
        e.preventDefault();
    }

    function closeUserProfile() {
        viewProfile = false;
    }

    function goToMessageIndex() {
        dispatch("goToMessageIndex", {
            index: msg.messageIndex,
            preserveFocus: false,
        });
    }
</script>

{#if viewProfile}
    <ViewUserProfile
        alignTo={usernameLinkBoundingRect}
        userId={sender.userId}
        on:openDirectChat={chatWithUser}
        on:close={closeUserProfile} />
{/if}

<div class="message-row" class:me on:click={goToMessageIndex}>
    <div
        class="message-bubble"
        class:fill={fill && !deleted}
        class:me
        class:deleted
        class:crypto
        class:rtl={$rtlStore}>
        {#if !me && !deleted}
            <div class="sender" class:fill class:rtl={$rtlStore}>
                <Link bind:this={usernameLink} underline={"hover"} on:click={openUserProfile}>
                    <h4 class="username" class:fill class:crypto>{username}</h4>
                </Link>
            </div>
        {/if}
        {#if msg.repliesTo !== undefined && !deleted}
            {#if msg.repliesTo.kind === "rehydrated_reply_context"}
                <RepliesTo
                    messageId={msg.messageId}
                    preview={true}
                    {chatId}
                    groupChat={true}
                    repliesTo={msg.repliesTo} />
            {:else}
                <UnresolvedReply repliesTo={msg.repliesTo} />
            {/if}
        {/if}

        <ChatMessageContent
            preview={true}
            pinned={true}
            {senderId}
            {fill}
            {chatId}
            edited={msg.edited}
            messageIndex={msg.messageIndex}
            messageId={msg.messageId}
            first={true}
            groupChat={true}
            {me}
            myUserId={user.userId}
            content={msg.content} />
    </div>
</div>

<style type="text/scss">
    :global(.message-bubble .content a) {
        text-decoration: underline;
    }

    :global(.message-bubble .content ul) {
        margin: 0 $sp4;
    }

    .sender {
        margin-bottom: $sp1;

        &.fill {
            position: absolute;
            background-color: rgba(0, 0, 0, 0.3);
            color: #fff;
            padding: $sp2 $sp4;
            border-radius: 0 0 $sp4 0;

            &.rtl {
                right: 0;
                border-radius: 0 0 0 $sp4;
            }
        }
    }

    .message-row {
        display: flex;
        justify-content: flex-start;
        cursor: pointer;
        margin-bottom: $sp2;

        &.me {
            justify-content: flex-end;
        }
    }

    .message-bubble {
        $radius: $sp4;
        $inner-radius: 4px;
        transition: box-shadow ease-in-out 200ms, background-color ease-in-out 200ms,
            border ease-in-out 300ms, transform ease-in-out 200ms;
        position: relative;
        padding: 6px $sp3 6px $sp3;
        background-color: var(--currentChat-msg-bg);
        color: var(--txt);
        @include font(book, normal, fs-100);
        border-radius: $radius;
        overflow: hidden;

        .username {
            color: inherit;
            color: var(--txt);
            display: inline;
        }

        &.me {
            background-color: var(--currentChat-msg-me-bg);
            color: var(--currentChat-msg-me-txt);
        }

        &.crypto {
            @include gold();
        }

        &.fill {
            padding: 0;
            overflow: hidden;
            border: none;
            line-height: 0;
        }

        &.deleted {
            opacity: 0.8;
        }

        &:after {
            content: "";
            display: table;
            clear: both;
        }
    }

    .username {
        margin: 0;
        @include font(bold, normal, fs-100);
        color: #fff;
    }
</style>
