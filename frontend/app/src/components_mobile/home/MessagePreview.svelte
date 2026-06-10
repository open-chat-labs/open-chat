<script lang="ts">
    import { Avatar, Body } from "component-lib";
    import {
        allUsersStore,
        currentUserIdStore,
        OpenChat,
        selectedChatWebhooksStore,
        selectedCommunityMembersStore,
        type RehydratedMessagePreview,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import ChatMessageContent from "./ChatMessageContent.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        preview: RehydratedMessagePreview;
        me: boolean;
        intersecting: boolean;
    }

    const { preview, me, intersecting }: Props = $props();

    let senderIsMe = $derived(preview.message.sender === $currentUserIdStore);
    let displayName = $derived(
        senderIsMe
            ? client.toTitleCase($_("you"))
            : client.getDisplayName(
                  preview.message.sender,
                  $selectedCommunityMembersStore,
                  $selectedChatWebhooksStore,
              ),
    );
</script>

<a class="preview_link" href={preview.url}>
    <div
        class="wrapper"
        class:me
        class:sender_is_me={senderIsMe}
        class:p2pSwap={preview.message.content.kind === "p2p_swap_content"}>
        <div class="title">
            <Avatar
                url={client.userAvatarUrl($allUsersStore.get(preview.message.sender))}
                size={"xs"} />
            <Body fontWeight="bold" colour={me ? "textPrimary" : "textSecondary"}>
                {displayName}
            </Body>
        </div>
        <div class="inert">
            <ChatMessageContent
                me={senderIsMe}
                readonly
                messageContext={{
                    chatId: preview.chatId,
                    threadRootMessageIndex: preview.threadRootMessageIndex,
                }}
                {intersecting}
                messageId={preview.message.messageId}
                messageIndex={preview.message.messageIndex}
                senderId={preview.message.sender}
                edited={preview.message.edited}
                fill={false}
                failed={false}
                blockLevelMarkdown
                truncate={true}
                reply={false}
                isPreview={true}
                content={preview.message.content}
                ogPreviews={preview.message.ogPreviews} />
        </div>
    </div>
</a>

<style lang="scss">
    .preview_link {
        width: 100%;
    }
    .wrapper {
        display: flex;
        flex-direction: column;
        gap: var(--sp-xs);
        width: 100%;
        overflow: hidden;
        padding: var(--sp-sm) var(--sp-xs) var(--sp-xs);

        &.me {
            &.sender_is_me {
                // TODO bgs are same as for replies, reduce duplication
                background-color: var(--background-2);
            }

            &:not(.sender_is_me) {
                background-color: var(--primary-muted);
            }
        }

        &:not(.me) {
            background-color: var(--background-1);
        }

        .inert {
            pointer-events: none;
        }

        &.p2pSwap {
            max-width: 350px;
        }
    }

    .title {
        gap: $sp3;
        display: flex;
        padding: 0 var(--sp-sm);

        > * {
            flex: 1;
        }
    }
</style>
