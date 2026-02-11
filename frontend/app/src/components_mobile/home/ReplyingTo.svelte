<script lang="ts">
    import { ColourVars, Column, IconButton, Row, ChatCaption } from "component-lib";
    import type { CreatedUser, EnhancedReplyContext, OpenChat } from "openchat-client";
    import { selectedChatWebhooksStore, selectedCommunityMembersStore } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Close from "svelte-material-icons/Close.svelte";
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
</script>

<Column
    backgroundColor={me ? ColourVars.myChatBubble : ColourVars.background2}
    borderRadius={"md"}
    padding={["zero", "zero", "md", "xl"]}
    minWidth={"120px"}
    maxHeight={"10rem"}
    width="fill"
    gap={"zero"}>
    <div class="reply">
        <Row crossAxisAlignment={"center"}>
            <ChatCaption fontWeight={"bold"}>
                {displayName}
            </ChatCaption>
            <IconButton onclick={onCancelReply} size="sm">
                {#snippet icon(_color)}
                    <Close color={me ? ColourVars.textPrimary : ColourVars.textSecondary} />
                {/snippet}
            </IconButton>
        </Row>
        <div class="reply-content">
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
    </div>
</Column>

<style lang="scss">
    :global(.replying.me a) {
        color: inherit;
    }

    :global {
        .reply {
            width: 100%;

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
        }

        .reply-content {
            pointer-events: none;
            padding-right: var(--sp-md);

            a {
                color: inherit;
            }
        }
    }
</style>
