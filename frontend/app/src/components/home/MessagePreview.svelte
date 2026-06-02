<script lang="ts">
    import {
        allUsersStore,
        AvatarSize,
        currentUserIdStore,
        OpenChat,
        selectedChatWebhooksStore,
        selectedCommunityMembersStore,
        type RehydratedMessagePreview,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Avatar from "../Avatar.svelte";
    import ChatMessageContent from "./ChatMessageContent.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        preview: RehydratedMessagePreview;
        intersecting: boolean;
    }

    const { preview, intersecting }: Props = $props();

    let me = $derived(preview.message.sender === $currentUserIdStore);
    let displayName = $derived(
        me
            ? client.toTitleCase($_("you"))
            : client.getDisplayName(
                  preview.message.sender,
                  $selectedCommunityMembersStore,
                  $selectedChatWebhooksStore,
              ),
    );
</script>

<a href={preview.url}>
    <div
        class="wrapper"
        class:me
        class:p2pSwap={preview.message.content.kind === "p2p_swap_content"}>
        <div class="title">
            <Avatar
                url={client.userAvatarUrl($allUsersStore.get(preview.message.sender))}
                userId={preview.message.sender}
                size={AvatarSize.Tiny} />
            <h4
                class="username"
                class:text-content={preview.message.content.kind === "text_content"}>
                {displayName}
            </h4>
        </div>
        <div class="inert">
            <ChatMessageContent
                {me}
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
                truncate
                reply
                content={preview.message.content}
                ogPreviews={preview.message.ogPreviews} />
        </div>
    </div>
</a>

<style lang="scss">
    .wrapper {
        padding: $sp3;
        border-radius: $sp3;
        background-color: color-mix(in srgb, var(--currentChat-msg-bg), black 15%);
        overflow: hidden;
        @include nice-scrollbar();
        max-height: 300px;
        margin-bottom: $sp2;

        &.me {
            background-color: color-mix(in srgb, var(--currentChat-msg-me-bg), black 15%);
        }

        .inert {
            pointer-events: none;
        }

        &:after {
            content: "";
            display: table;
            clear: both;
        }

        &.p2pSwap {
            max-width: 350px;
        }
    }

    .title {
        display: flex;
        gap: $sp3;
        > * {
            flex: 1;
        }
    }
</style>
