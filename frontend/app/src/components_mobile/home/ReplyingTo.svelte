<script lang="ts">
    import { ColourVars, Column, IconButton, Row, ChatCaption } from "component-lib";
    import type { CreatedUser, EnhancedReplyContext, OpenChat } from "openchat-client";
    import { selectedChatWebhooksStore, selectedCommunityMembersStore } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Close from "svelte-material-icons/Close.svelte";
    import ChatMessageContent from "./ChatMessageContent.svelte";
    import ChatMessageReplyContent from "./ChatMessageReplyContent.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        replyingTo: EnhancedReplyContext;
        user: CreatedUser;
        readonly: boolean;
        timestamp?: bigint | undefined;
        onCancelReply: () => void;
    }

    let { replyingTo, user, readonly, timestamp = undefined, onCancelReply }: Props = $props();

    let me = $derived(replyingTo.sender?.userId === user?.userId);

    let displayName = $derived(
        me
            ? client.toTitleCase($_("you"))
            : client.getDisplayName(
                  replyingTo.sender?.userId,
                  $selectedCommunityMembersStore,
                  $selectedChatWebhooksStore,
              ),
    );

    let fillReplyCancel = $derived(
        ["image_content", "video_content"].indexOf(replyingTo.content.kind) > -1,
    );

    // This is transitional, until we adjust replies for different content types.
    let hasDedicatedReplyContent = $derived(
        ["image_content"].indexOf(replyingTo.content.kind) > -1,
    );
</script>

<Column
    borderRadius={"md"}
    padding={["xs", "xs", "zero"]}
    minWidth={"120px"}
    maxHeight={"10rem"}
    width="fill"
    gap={"zero"}>
    <div class="reply_wrapper" class:me class:with_padding={!hasDedicatedReplyContent}>
        <div class="cancel_reply" class:filled={fillReplyCancel}>
            <IconButton onclick={onCancelReply} size="sm">
                {#snippet icon(_color)}
                    <Close color={ColourVars.textSecondary} />
                {/snippet}
            </IconButton>
        </div>
        {#if hasDedicatedReplyContent}
            <div class="reply_content" class:me>
                <ChatMessageReplyContent
                    showPreviews={false}
                    {displayName}
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
                    reply />
            </div>
        {:else}
            <Row crossAxisAlignment={"center"}>
                <ChatCaption fontWeight={"bold"}>
                    {displayName}
                </ChatCaption>
            </Row>
            <div class="reply_content no_padding" class:me>
                <ChatMessageContent
                    showPreviews={false}
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
                    reply />
            </div>
        {/if}
    </div>
</Column>

<style lang="scss">
    :global(.replying.me a) {
        color: inherit;
    }

    :global {
        .reply_wrapper {
            width: 100%;
            position: relative;
            padding-left: var(--sp-xl);
            background-color: var(--background-2);
            border-radius: var(--rad-lg) var(--rad-lg) var(--rad-sm) var(--rad-sm);

            &:before {
                content: "";
                display: block;
                position: absolute;
                width: 0.25rem;
                left: 0.5rem;
                top: 0.5rem;
                bottom: 0.5rem;
                background-color: var(--primary-light);
                border-radius: var(--rad-circle);
            }

            &.me:before {
                background-color: var(--secondary-light);
            }

            &.with_padding {
                padding-top: var(--sp-sm);
                padding-bottom: var(--sp-sm);
            }
        }

        .cancel_reply {
            position: absolute;
            right: -0.05rem;
            top: -0.05rem;
            z-index: 1;

            &.filled {
                background-color: var(--background-2);
                border-radius: var(--rad-circle);
            }

            &.filled > .icon_button {
                padding: var(--sp-xxs) !important;
            }
        }

        .reply_content {
            pointer-events: none;
            padding: var(--sp-xs);
            padding-left: 0;

            &.no_padding {
                padding: 0;
            }

            a {
                color: inherit;
            }
        }
    }
</style>
