<script lang="ts">
    import { Body, ColourVars, Column, IconButton, Row } from "component-lib";
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
    padding={["zero", "zero", "md", "md"]}
    minWidth={"120px"}
    maxHeight={"10rem"}
    gap={"sm"}>
    <Row crossAxisAlignment={"center"}>
        <Body fontWeight={"bold"}>
            {displayName}
        </Body>
        <IconButton onclick={onCancelReply}>
            {#snippet icon(_color)}
                <Close color={me ? "#fff" : "#aaa"} />
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
</Column>

<style lang="scss">
    :global(.replying.me a) {
        color: inherit;
    }

    :global {
        .reply-content {
            pointer-events: none;

            a {
                color: inherit;
            }
        }
    }
</style>
