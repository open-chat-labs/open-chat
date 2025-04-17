<script lang="ts">
    import type { CreatedUser, Message, MultiUserChatIdentifier, OpenChat } from "openchat-client";
    import { AvatarSize, app, routeForMessage, ui, userStore } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import { rtlStore } from "../../../stores/rtl";
    import Avatar from "../../Avatar.svelte";
    import Link from "../../Link.svelte";
    import type { ProfileLinkClickedEvent } from "../../web-components/profileLink";
    import ChatMessageContent from "../ChatMessageContent.svelte";
    import IntersectionObserver from "../IntersectionObserver.svelte";
    import RepliesTo from "../RepliesTo.svelte";
    import UnresolvedReply from "../UnresolvedReply.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chatId: MultiUserChatIdentifier;
        user: CreatedUser;
        senderId: string;
        msg: Message;
        timestamp: bigint;
    }

    let { chatId, user, senderId, msg, timestamp }: Props = $props();

    let crypto = msg.content.kind === "crypto_content";

    let sender = $derived($userStore.get(senderId));
    let username = $derived(client.getDisplayName(sender, app.selectedCommunityDetails.members));
    let deleted = $derived(msg.content.kind === "deleted_content");
    let fill = $derived(client.fillMessage(msg));
    let me = $derived(user.userId === senderId);
    let modal = $derived(!ui.fullWidth);

    function openUserProfile(e: Event) {
        if (!sender) return;

        e.preventDefault();
        e.target?.dispatchEvent(
            new CustomEvent<ProfileLinkClickedEvent>("profile-clicked", {
                detail: {
                    userId: sender.userId,
                    chatButton: !me,
                    inGlobalContext: false,
                },
                bubbles: true,
            }),
        );
    }

    function goToMessageIndex() {
        if (app.selectedMessageContext !== undefined) {
            if (modal) {
                ui.popRightPanelHistory();
            }
            page(
                routeForMessage(
                    app.chatListScope.kind,
                    app.selectedMessageContext,
                    msg.messageIndex,
                ),
            );
        }
    }
</script>

<div class="message-row" class:me onclick={goToMessageIndex}>
    <div class="avatar" onclick={openUserProfile}>
        <Avatar
            url={client.userAvatarUrl(sender)}
            userId={sender?.userId}
            size={ui.mobileWidth ? AvatarSize.Small : AvatarSize.Default} />
    </div>
    <IntersectionObserver>
        {#snippet children(intersecting)}
            <div
                class="message-bubble"
                class:fill={fill && !deleted}
                class:me
                class:deleted
                class:crypto
                class:rtl={$rtlStore}>
                {#if !deleted}
                    <div class="sender" class:fill class:rtl={$rtlStore}>
                        <Link underline={"never"} onClick={openUserProfile}>
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
                    content={msg.content}
                    blockLevelMarkdown={msg.blockLevelMarkdown} />
            </div>
        {/snippet}
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
