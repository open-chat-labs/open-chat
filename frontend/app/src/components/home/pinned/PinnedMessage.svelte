<svelte:options immutable />

<script lang="ts">
    import Link from "../../Link.svelte";
    import type { CreatedUser, Message, MultiUserChatIdentifier, OpenChat } from "openchat-client";
    import { userStore, currentCommunityMembers as communityMembers } from "openchat-client";
    import ChatMessageContent from "../ChatMessageContent.svelte";
    import RepliesTo from "../RepliesTo.svelte";
    import Avatar from "../../Avatar.svelte";
    import { AvatarSize } from "openchat-client";
    import UnresolvedReply from "../UnresolvedReply.svelte";
    import { rtlStore } from "../../../stores/rtl";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import { createEventDispatcher, getContext } from "svelte";
    import type { ProfileLinkClickedEvent } from "../../web-components/profileLink";
    import IntersectionObserver from "../IntersectionObserver.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let chatId: MultiUserChatIdentifier;
    export let user: CreatedUser;
    export let senderId: string;
    export let msg: Message;
    export let timestamp: bigint;

    let crypto = msg.content.kind === "crypto_content";

    $: sender = $userStore.get(senderId);
    $: username = client.getDisplayName(sender, $communityMembers);
    $: deleted = msg.content.kind === "deleted_content";
    $: fill = client.fillMessage(msg);
    $: me = user.userId === senderId;

    function openUserProfile(e: Event) {
        if (!sender) return;

        e.preventDefault();
        e.target?.dispatchEvent(
            new CustomEvent<ProfileLinkClickedEvent>("profile-clicked", {
                detail: { userId: sender.userId, chatButton: !me, inGlobalContext: false },
                bubbles: true,
            }),
        );
    }

    function goToMessageIndex() {
        dispatch("goToMessageIndex", {
            index: msg.messageIndex,
            preserveFocus: false,
        });
    }
</script>

<div class="message-row" class:me on:click={goToMessageIndex}>
    <div class="avatar" on:click={openUserProfile}>
        <Avatar
            url={client.userAvatarUrl(sender)}
            userId={sender?.userId}
            size={$mobileWidth ? AvatarSize.Small : AvatarSize.Default} />
    </div>
    <IntersectionObserver let:intersecting>
        <div
            class="message-bubble"
            class:fill={fill && !deleted}
            class:me
            class:deleted
            class:crypto
            class:rtl={$rtlStore}>
            {#if !deleted}
                <div class="sender" class:fill class:rtl={$rtlStore}>
                    <Link underline={"never"} on:click={openUserProfile}>
                        <h4 class="username" class:fill class:crypto>{username}</h4>
                    </Link>
                </div>
            {/if}
            {#if msg.repliesTo !== undefined && !deleted}
                {#if msg.repliesTo.kind === "rehydrated_reply_context"}
                    <RepliesTo {intersecting} readonly {chatId} repliesTo={msg.repliesTo} />
                {:else}
                    <UnresolvedReply />
                {/if}
            {/if}

            <ChatMessageContent
                readonly
                pinned
                {senderId}
                {fill}
                {timestamp}
                failed={false}
                messageContext={{ chatId }}
                edited={msg.edited}
                messageIndex={msg.messageIndex}
                messageId={msg.messageId}
                {me}
                {intersecting}
                myUserId={user.userId}
                content={msg.content}
                blockLevelMarkdown={msg.blockLevelMarkdown} />
        </div>
    </IntersectionObserver>
</div>

<style lang="scss">
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
            z-index: 1;

            &.rtl {
                right: 0;
                border-radius: 0 0 0 $sp4;
            }
        }
    }

    $avatar-width: 56px;
    $avatar-width-mob: 43px;

    .message-row {
        display: flex;
        justify-content: flex-start;
        cursor: pointer;
        margin-bottom: $sp4;
        gap: $sp3;

        .avatar {
            flex: 0 0 $avatar-width;
            cursor: pointer;

            @include mobile() {
                flex: 0 0 $avatar-width-mob;
            }
        }
    }

    .message-bubble {
        $radius: $sp3;
        $inner-radius: 4px;
        transition:
            box-shadow ease-in-out 200ms,
            background-color ease-in-out 200ms,
            border ease-in-out 300ms,
            transform ease-in-out 200ms;
        position: relative;
        padding: 6px $sp3 6px $sp3;
        background-color: var(--currentChat-msg-bg);
        color: var(--currentChat-msg-txt);
        @include font(book, normal, fs-100);
        border-radius: $radius;
        overflow: hidden;
        pointer-events: none;

        .username {
            color: inherit;
            display: inline;
        }

        &.me {
            background-color: var(--currentChat-msg-me-bg);
            color: var(--currentChat-msg-me-txt);
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
