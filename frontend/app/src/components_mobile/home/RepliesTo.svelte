<script lang="ts">
    import { BodySmall } from "component-lib";
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
    import ChatMessageContent from "./ChatMessageContent.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chatId: ChatIdentifier;
        repliesTo: RehydratedReplyContext;
        readonly: boolean;
        intersecting: boolean;
        onRemovePreview?: (url: string) => void;
    }

    let { repliesTo, readonly, intersecting, onRemovePreview }: Props = $props();

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

<div class="quote">
    <BodySmall fontWeight={"bold"}>
        {displayName}
    </BodySmall>
    {#if repliesTo.content !== undefined}
        <div class="inert">
            <ChatMessageContent
                showPreviews
                {me}
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
                {onRemovePreview}
                content={repliesTo.content} />
        </div>
        {#if debug}
            <pre>EventIdx: {repliesTo.eventIndex}</pre>
            <pre>MsgId: {repliesTo.messageId}</pre>
            <pre>SenderId: {repliesTo.senderId}</pre>
        {/if}
    {:else}
        {"TODO - we don't have the message content for this"}
    {/if}
</div>

<style lang="scss">
    .quote {
        border-left: 4px solid var(--primary-light);
        padding-left: var(--sp-md);
    }
</style>
