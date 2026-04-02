<script lang="ts">
    import { Column } from "component-lib";
    import {
        currentUserIdStore,
        OpenChat,
        selectedChatWebhooksStore,
        selectedCommunityMembersStore,
        type ChatIdentifier,
        type RehydratedReplyContext,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import ChatMessageReplyContent from "./ChatMessageReplyContent.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chatId: ChatIdentifier;
        repliesTo: RehydratedReplyContext;
        readonly: boolean;
        intersecting: boolean;
    }

    let { repliesTo, readonly, intersecting }: Props = $props();

    let debug = false;

    let me = $derived(repliesTo.senderId === $currentUserIdStore);
    let displayName = $derived(
        me
            ? client.toTitleCase($_("you"))
            : client.getDisplayName(
                  repliesTo.senderId,
                  $selectedCommunityMembersStore,
                  $selectedChatWebhooksStore,
              ),
    );
</script>

<Column supplementalClass={`replies_to ${me ? "me" : ""}`} padding="sm" borderRadius="md">
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
                background-color: var(--primary-light);
                border-radius: var(--rad-circle);
            }

            &.me:before {
                background-color: var(--secondary-light);
            }
        }

        // Rules for a reply on my message.
        .reply_wrapper.me > .replies_to {
            border-top-left-radius: var(--rad-lg) !important;

            &.me {
                background-color: var(--background-2);
            }

            &:not(.me) {
                background-color: var(--primary-muted);
            }
        }

        .reply_wrapper:not(.me) > .replies_to {
            border-top-right-radius: var(--rad-lg) !important;
            background-color: var(--background-0);
        }
    }
</style>
