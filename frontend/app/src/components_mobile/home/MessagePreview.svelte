<script lang="ts">
    import { trackedEffect } from "@src/utils/effects.svelte";
    import { Avatar, Body } from "component-lib";
    import {
        allUsersStore,
        currentUserIdStore,
        eventListScrolling,
        isSuccessfulEventsResponse,
        OpenChat,
        selectedChatWebhooksStore,
        selectedCommunityMembersStore,
        type MessageContent,
        type MultiUserChatIdentifier,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
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
        chatId: MultiUserChatIdentifier;
        threadRootMessageIndex: number | undefined;
        messageIndex: number;
        intersecting: boolean;
        onRendered: (url: string) => void;
    }

    let { url, me, chatId, threadRootMessageIndex, messageIndex, intersecting, onRendered }: Props =
        $props();

    let previewPromise: Promise<Preview | undefined> | undefined = $state();
    let rendered = $state(false);
    let senderIsMe = $state(false);

    async function loadPreview(): Promise<Preview | undefined> {
        let result = await client.getMessagesByMessageIndex(chatId, threadRootMessageIndex, [
            messageIndex,
        ]);

        if (!isSuccessfulEventsResponse(result)) {
            return;
        }

        let message = result.events[0].event;

        senderIsMe = message.sender === $currentUserIdStore;

        return {
            content: message.content,
            senderId: message.sender,
            messageId: message.messageId,
            edited: message.edited,
            displayName: senderIsMe
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
            <a class="preview_link" href={url}>
                <div
                    class="wrapper"
                    class:me
                    class:sender_is_me={senderIsMe}
                    class:p2pSwap={preview.content.kind === "p2p_swap_content"}>
                    <div class="title">
                        <Avatar
                            url={client.userAvatarUrl($allUsersStore.get(preview.senderId))}
                            size={"xs"} />
                        <Body fontWeight="bold" colour={me ? "textPrimary" : "textSecondary"}>
                            {preview.displayName}
                        </Body>
                    </div>
                    <div class="inert">
                        <ChatMessageContent
                            showPreviews
                            me={senderIsMe}
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
                            truncate={true}
                            reply={false}
                            isPreview={true}
                            content={preview.content} />
                    </div>
                </div>
            </a>
        {/if}
    {/await}
{/if}

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
