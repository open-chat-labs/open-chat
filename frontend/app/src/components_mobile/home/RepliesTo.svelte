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

<Column supplementalClass={`replies_to ${me ? "me" : ""}`}>
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
            padding-left: var(--sp-md) !important;

            // Same CSS is defined in ReplyingTo.svelte
            &:before {
                content: "";
                display: block;
                position: absolute;
                left: 0;
                height: 100%;
                width: 0.25rem;
                background-color: var(--primary-light);
                border-radius: var(--rad-circle);
            }

            &.me:before {
                background-color: var(--secondary-light);
            }
        }
    }
</style>
