<script lang="ts">
    import { BodySmall } from "component-lib";
    import {
        chatIdentifiersEqual,
        chatListScopeStore,
        currentUserIdStore,
        OpenChat,
        routeForChatIdentifier,
        selectedChatWebhooksStore,
        selectedCommunityMembersStore,
        type ChatIdentifier,
        type RehydratedReplyContext,
    } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Link from "../Link.svelte";
    import ChatMessageContent from "./ChatMessageContent.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chatId: ChatIdentifier;
        repliesTo: RehydratedReplyContext;
        readonly: boolean;
        intersecting: boolean;
        onGoToMessageIndex?: (args: { index: number }) => void;
        onRemovePreview?: (url: string) => void;
    }

    let { chatId, repliesTo, readonly, intersecting, onGoToMessageIndex, onRemovePreview }: Props =
        $props();

    let debug = false;

    let me = $derived(repliesTo.senderId === $currentUserIdStore);
    let isTextContent = $derived(repliesTo.content?.kind === "text_content");
    let isP2PSwap = $derived(repliesTo.content.kind === "p2p_swap_content");
    let displayName = $derived(
        me
            ? client.toTitleCase($_("you"))
            : client.getDisplayName(
                  repliesTo.senderId,
                  $selectedCommunityMembersStore,
                  $selectedChatWebhooksStore,
              ),
    );

    function getUrl() {
        const path = [
            routeForChatIdentifier($chatListScopeStore.kind, repliesTo.sourceContext.chatId),
            repliesTo.sourceContext.threadRootMessageIndex ?? repliesTo.messageIndex,
        ];
        if (repliesTo.sourceContext.threadRootMessageIndex !== undefined) {
            path.push(repliesTo.messageIndex);
        }
        return path.join("/");
    }

    function zoomToMessage() {
        if (chatIdentifiersEqual(repliesTo.sourceContext.chatId, chatId)) {
            onGoToMessageIndex?.({
                index: repliesTo.messageIndex,
            });
        } else {
            page(getUrl());
        }
    }
</script>

<Link onClick={zoomToMessage}>
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
</Link>

<style lang="scss">
    .inert {
        pointer-events: none;
    }

    .quote {
        border-left: 4px solid var(--primary-light);
        padding-left: var(--sp-md);
    }
</style>
