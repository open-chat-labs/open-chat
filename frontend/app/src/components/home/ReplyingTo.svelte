<script lang="ts">
    import type { CreatedUser, EnhancedReplyContext, OpenChat } from "@client";
    import {
        allUsersStore,
        BRIDGE_PLATFORM_NAMES,
        bridgedAuthorName,
        bridgedFrom,
        bridgedUserKey,
        bridgedUsersStore,
        iconSize,
        linkedAuthor,
        selectedChatWebhooksStore,
        selectedCommunityMembersStore,
        shouldShowAsMe,
    } from "@client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Close from "svelte-material-icons/Close.svelte";
    import { rtlStore } from "../../stores/rtl";
    import HoverIcon from "../HoverIcon.svelte";
    import ChatMessageContent from "./ChatMessageContent.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        replyingTo: EnhancedReplyContext;
        user: CreatedUser;
        readonly: boolean;
        timestamp?: bigint | undefined;
        onCancelReply: () => void;
    }

    let { replyingTo, user, readonly, timestamp = undefined, onCancelReply }: Props = $props();

    // Who the message is shown as from, as in the chat: the OpenChat user who linked the account a
    // bridge bot relayed it from, or else the account itself
    let bridged = $derived(bridgedFrom(replyingTo.senderContext));
    let bridgedUser = $derived(
        bridged !== undefined ? $bridgedUsersStore.get(bridgedUserKey(bridged)!) : undefined,
    );
    let linkedUser = $derived(linkedAuthor(bridgedUser, $allUsersStore));
    let me = $derived(
        shouldShowAsMe(
            replyingTo.sender?.userId === user?.userId,
            linkedUser?.userId,
            user?.userId,
        ),
    );

    let displayName = $derived(
        me
            ? client.toTitleCase($_("you"))
            : bridged !== undefined && linkedUser === undefined
              ? (bridgedAuthorName(bridgedUser) ??
                $_("bridgedUserUnknown", {
                    values: { platform: BRIDGE_PLATFORM_NAMES[bridged.kind] },
                }))
              : client.getDisplayName(
                    linkedUser?.userId ?? replyingTo.sender?.userId,
                    $selectedCommunityMembersStore,
                    $selectedChatWebhooksStore,
                ),
    );
</script>

<div
    class="replying"
    class:me
    class:rtl={$rtlStore}
    class:crypto={replyingTo.content.kind === "crypto_content"}>
    <div class="close-icon" onclick={onCancelReply}>
        <HoverIcon compact>
            <Close size={$iconSize} color={me ? "#fff" : "#aaa"} />
        </HoverIcon>
    </div>
    <h4 class="username">
        {displayName}
    </h4>
    <div class="reply-content">
        <ChatMessageContent
            {readonly}
            {timestamp}
            messageContext={replyingTo.sourceContext}
            fill={false}
            failed={false}
            blockLevelMarkdown={false}
            {me}
            intersecting={true}
            messageId={replyingTo.messageId}
            messageIndex={replyingTo.messageIndex}
            senderId={replyingTo.senderId}
            truncate
            edited={replyingTo.edited}
            content={replyingTo.content}
            ogPreviews={[]}
            reply />
    </div>
</div>

<style lang="scss">
    :global(.replying.me a) {
        color: inherit;
    }

    .replying {
        @include font(book, normal, fs-100);
        margin-top: $sp4;
        min-width: 120px;
        border-radius: $sp3;
        padding: $sp3;
        background-color: var(--currentChat-msg-bg);
        color: var(--currentChat-msg-txt);
        position: relative;
        @include nice-scrollbar();
        max-height: 150px;

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

        .reply-content {
            pointer-events: none;
        }
    }

    .username {
        margin: 0;
        margin-bottom: $sp2;
    }
</style>
