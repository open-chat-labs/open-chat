<script lang="ts">
    import { Column } from "component-lib";
    import {
        allUsersStore,
        BRIDGE_PLATFORM_NAMES,
        bridgedAuthorName,
        bridgedFrom,
        bridgedUserKey,
        bridgedUsersStore,
        currentUserIdStore,
        linkedAuthor,
        OpenChat,
        selectedChatWebhooksStore,
        selectedCommunityMembersStore,
        shouldShowAsMe,
        type ChatIdentifier,
        type RehydratedReplyContext,
    } from "@client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import ChatMessageReplyContent from "./ChatMessageReplyContent.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chatId: ChatIdentifier;
        repliesTo: RehydratedReplyContext;
        readonly: boolean;
        intersecting: boolean;
        contentWidth?: number;
    }

    let { repliesTo, readonly, intersecting, contentWidth }: Props = $props();

    const debug = false;

    // Who the quoted message is shown as from, as in the chat: the OpenChat user who linked the
    // account a bridge bot relayed it from, or else the account itself
    let bridged = $derived(bridgedFrom(repliesTo.senderContext));
    let bridgedUser = $derived(
        bridged !== undefined ? $bridgedUsersStore.get(bridgedUserKey(bridged)!) : undefined,
    );
    let linkedUser = $derived(linkedAuthor(bridgedUser, $allUsersStore));
    let me = $derived(
        shouldShowAsMe(
            repliesTo.senderId === $currentUserIdStore,
            linkedUser?.userId,
            $currentUserIdStore,
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
                    linkedUser?.userId ?? repliesTo.senderId,
                    $selectedCommunityMembersStore,
                    $selectedChatWebhooksStore,
                ),
    );
</script>

<Column
    width={contentWidth ? { size: `${contentWidth}px` } : undefined}
    supplementalClass={`replies_to ${me ? "me" : ""}`}
    padding="sm"
    borderRadius="md">
    {#if repliesTo.content !== undefined}
        <ChatMessageReplyContent
            {me}
            {displayName}
            {readonly}
            messageContext={repliesTo.sourceContext}
            {intersecting}
            messageId={repliesTo.messageId}
            messageIndex={repliesTo.messageIndex}
            senderId={repliesTo.senderId}
            edited={false}
            fill={false}
            failed={false}
            blockLevelMarkdown={true}
            truncate
            reply
            content={repliesTo.content} />
        {#if debug}
            <pre>EventIdx: {repliesTo.eventIndex}</pre>
            <pre>MsgId: {repliesTo.messageId}</pre>
            <pre>SenderId: {repliesTo.senderId}</pre>
        {/if}
    {:else}
        {"TODO - we don't have the message content for this"}
    {/if}
</Column>

<style lang="scss">
    :global {
        .container.replies_to {
            position: relative;
            pointer-events: none;
            padding-left: 1.25rem !important;

            // Same CSS is defined in ReplyingTo.svelte
            &:before {
                content: "";
                display: block;
                position: absolute;
                left: var(--sp-sm);
                top: var(--sp-sm);
                bottom: var(--sp-sm);
                width: 0.25rem;
                background-color: var(--primary-accent);
                border-radius: var(--rad-circle);
            }

            &.me:before {
                background-color: var(--secondary-accent);
            }
        }

        // Rules for a reply on my message.
        .reply_wrapper.me > .replies_to {
            border-top-left-radius: var(--rad-lg) !important;

            &.me {
                background-color: var(--surface-2);
            }

            &:not(.me) {
                background-color: var(--primary-surface);
            }
        }

        .reply_wrapper:not(.me) > .replies_to {
            border-top-right-radius: var(--rad-lg) !important;
            background-color: var(--chat-bubble-reply-received);
        }
    }
</style>
