<script lang="ts">
    import { trackedEffect } from "@src/utils/effects.svelte";
    import {
        allUsersStore,
        AvatarSize,
        eventListScrolling,
        isSuccessfulEventsResponse,
        OpenChat,
        selectedChatWebhooksStore,
        selectedCommunityMembersStore,
        type ChatIdentifier,
        type MessageContent,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Avatar from "../Avatar.svelte";
    import ChatMessageContent from "./ChatMessageContent.svelte";

    type Preview = {
        content: MessageContent;
        senderId: string;
        messageId: bigint;
        edited: boolean;
        displayName: string;
    };

    const client = getContext<OpenChat>("client");

    interface Props {
        url: string;
        me: boolean;
        chatId: ChatIdentifier;
        threadRootMessageIndex: number | undefined;
        messageIndex: number;
        intersecting: boolean;
        onRendered: (url: string) => void;
    }

    let { url, me, chatId, threadRootMessageIndex, messageIndex, intersecting, onRendered }: Props =
        $props();

    let previewPromise: Promise<Preview | undefined> | undefined = $state();
    let rendered = $state(false);

    async function loadPreview(): Promise<Preview | undefined> {
        let result = await client.getMessagesByMessageIndex(
            chatId,
            threadRootMessageIndex,
            new Set([messageIndex]),
        );

        if (!isSuccessfulEventsResponse(result)) {
            return;
        }

        let message = result.events[0].event;

        return {
            content: message.content,
            senderId: message.sender,
            messageId: message.messageId,
            edited: message.edited,
            displayName: me
                ? client.toTitleCase($_("you"))
                : client.getDisplayName(
                      message.sender,
                      $selectedCommunityMembersStore,
                      $selectedChatWebhooksStore,
                  ),
        };
    }

    trackedEffect("message-preview", () => {
        // make sure we only actually *load* the preview once
        previewPromise = previewPromise ?? loadPreview();
        previewPromise.then((preview) => {
            if (preview && intersecting && !$eventListScrolling) {
                rendered = true;
                onRendered(url);
            }
        });
    });
</script>

{#if rendered}
    {#await previewPromise then preview}
        {#if preview}
            <a href={url}>
                <div
                    class="wrapper"
                    class:me
                    class:p2pSwap={preview.content.kind === "p2p_swap_content"}>
                    <div class="title">
                        <Avatar
                            url={client.userAvatarUrl($allUsersStore.get(preview.senderId))}
                            userId={preview.senderId}
                            size={AvatarSize.Tiny} />
                        <h4
                            class="username"
                            class:text-content={preview.content.kind === "text_content"}>
                            {preview.displayName}
                        </h4>
                    </div>
                    <div class="inert">
                        <ChatMessageContent
                            showPreviews
                            {me}
                            readonly
                            messageContext={{
                                chatId,
                                threadRootMessageIndex,
                            }}
                            {intersecting}
                            messageId={preview.messageId}
                            {messageIndex}
                            senderId={preview.senderId}
                            edited={preview.edited}
                            fill={false}
                            failed={false}
                            blockLevelMarkdown
                            truncate
                            reply
                            content={preview.content} />
                    </div>
                </div>
            </a>
        {/if}
    {/await}
{/if}

<style lang="scss">
    .wrapper {
        overflow: hidden;
        @include nice-scrollbar();
        max-height: 300px;

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
