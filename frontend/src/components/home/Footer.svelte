<script lang="ts">
    import ReplyingTo from "./ReplyingTo.svelte";
    import MessageEntry from "./MessageEntry.svelte";
    import DraftMediaMessage from "./DraftMediaMessage.svelte";
    import { messageContentFromFile } from "../../utils/media";
    import { toastStore } from "../../stores/toast";
    import type {
        EventWrapper,
        GroupChatSummary,
        Message,
        MessageContent,
        PollContent,
    } from "../../domain/chat/chat";
    import { getMessageContent, getStorageRequiredForMessage } from "../../domain/chat/chat.utils";
    import { rollbar } from "../../utils/logging";
    import Loading from "../Loading.svelte";
    import type { ChatController } from "../../fsm/chat.controller";
    import type { User } from "../../domain/user/user";
    import Reload from "../Reload.svelte";
    import { _ } from "svelte-i18n";
    import { remainingStorage } from "../../stores/storage";
    import { createEventDispatcher } from "svelte";

    export let controller: ChatController;
    export let blocked: boolean;
    export let preview: boolean;
    export let joining: GroupChatSummary | undefined;

    const dispatch = createEventDispatcher();
    let showEmojiPicker = false;
    let messageEntry: MessageEntry;
    $: chat = controller.chat;
    $: fileToAttach = controller.fileToAttach;
    $: editingEvent = controller.editingEvent;
    $: replyingTo = controller.replyingTo;

    function cancelReply() {
        controller.cancelReply();
    }

    function editMessageWithAttachment(
        textContent: string | undefined,
        fileToAttach: MessageContent | undefined,
        editingEvent: EventWrapper<Message>
    ) {
        if (textContent || fileToAttach) {
            const msg = {
                ...editingEvent.event,
                edited: true,
                content: getMessageContent(textContent ?? undefined, fileToAttach),
            };

            controller.api
                .editMessage($chat, msg!)
                .then((resp) => {
                    if (resp !== "success") {
                        rollbar.warn("Error response editing", resp);
                        toastStore.showFailureToast("errorEditingMessage");
                    }
                })
                .catch((err) => {
                    rollbar.error("Exception sending message", err);
                    toastStore.showFailureToast("errorEditingMessage");
                });

            const event = { ...editingEvent, event: msg! };
            controller.sendMessage(event, controller.user.userId);
        }
    }

    function sendMessageWithAttachment(
        textContent: string | undefined,
        mentioned: User[],
        fileToAttach: MessageContent | undefined
    ) {
        if (textContent || fileToAttach) {
            const nextEventIndex = controller.getNextEventIndex();
            const storageRequired = getStorageRequiredForMessage(fileToAttach);
            if ($remainingStorage < storageRequired) {
                dispatch("upgrade", "explain");
                return;
            }

            const msg = controller.createMessage(textContent, fileToAttach);
            controller.api
                .sendMessage($chat, controller.user, mentioned, msg)
                .then((resp) => {
                    if (resp.kind === "success") {
                        controller.confirmMessage(msg, resp);
                    } else {
                        controller.removeMessage(msg.messageId, controller.user.userId);
                        rollbar.warn("Error response sending message", resp);
                        toastStore.showFailureToast("errorSendingMessage");
                    }
                })
                .catch((err) => {
                    controller.removeMessage(msg.messageId, controller.user.userId);
                    console.log(err);
                    toastStore.showFailureToast("errorSendingMessage");
                    rollbar.error("Exception sending message", err);
                });

            const event = { event: msg, index: nextEventIndex, timestamp: BigInt(Date.now()) };
            controller.sendMessage(event, controller.user.userId);
        }
    }

    function sendMessage(ev: CustomEvent<[string | undefined, User[]]>) {
        let [text, mentioned] = ev.detail;
        if ($editingEvent !== undefined) {
            editMessageWithAttachment(text, $fileToAttach, $editingEvent);
        } else {
            sendMessageWithAttachment(text, mentioned, $fileToAttach);
        }
    }

    export function sendPoll(ev: CustomEvent<PollContent>) {
        sendMessageWithAttachment(undefined, [], ev.detail);
    }

    function fileSelected(ev: CustomEvent<MessageContent>) {
        controller.attachFile(ev.detail);
    }

    function messageContentFromDataTransferItemList(items: DataTransferItem[]) {
        const file = items[0]?.getAsFile();
        if (!file) return;

        messageContentFromFile(file)
            .then((content) => controller.attachFile(content))
            .catch((err) => toastStore.showFailureToast(err));
    }

    function onDrop(e: CustomEvent<DragEvent>) {
        if (e.detail.dataTransfer) {
            messageContentFromDataTransferItemList([...e.detail.dataTransfer.items]);
            e.detail.preventDefault();
        }
    }

    function onPaste(e: ClipboardEvent) {
        if (e.clipboardData) {
            messageContentFromDataTransferItemList(
                [...e.clipboardData.items].filter((item) => /image/.test(item.type))
            );
            const text = e.clipboardData.getData("text/plain");
            if (text) {
                messageEntry.insertTextAtCaret(text);
            }
            e.preventDefault();
        }
    }
</script>

<div class="footer">
    <div class="footer-overlay">
        {#if $replyingTo || $fileToAttach !== undefined}
            <div class="draft-container">
                {#if $replyingTo}
                    <ReplyingTo
                        preview={true}
                        on:cancelReply={cancelReply}
                        user={controller.user}
                        replyingTo={$replyingTo} />
                {/if}
                {#if $fileToAttach !== undefined}
                    {#if $fileToAttach.kind === "image_content" || $fileToAttach.kind === "audio_content" || $fileToAttach.kind === "video_content" || $fileToAttach.kind === "file_content"}
                        <DraftMediaMessage content={$fileToAttach} />
                    {:else if $fileToAttach.kind === "crypto_content"}
                        <div>Crypto transfer preview</div>
                    {/if}
                {/if}
            </div>
        {/if}
        {#if showEmojiPicker}
            {#await import("./EmojiPicker.svelte")}
                <div class="loading-emoji"><Loading /></div>
            {:then picker}
                <svelte:component this={picker.default} />
            {:catch _error}
                <Reload>{$_("unableToLoadEmojiPicker")}</Reload>
            {/await}
        {/if}
    </div>
    <MessageEntry
        bind:this={messageEntry}
        bind:showEmojiPicker
        on:paste={onPaste}
        on:drop={onDrop}
        {preview}
        {blocked}
        {joining}
        on:sendMessage={sendMessage}
        on:createPoll
        on:fileSelected={fileSelected}
        on:audioCaptured={fileSelected}
        on:joinGroup
        on:cancelPreview
        {controller} />
</div>

<style type="text/scss">
    .loading-emoji {
        height: 400px;
    }

    .footer {
        position: relative;
    }

    .footer-overlay {
        width: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-content: center;
        align-items: center;
        background-color: var(--entry-bg);
    }

    .draft-container {
        max-width: 80%;
        padding-bottom: 8px;
    }

    :global(.footer-overlay emoji-picker) {
        --num-columns: 15 !important;
        @include size-below(md) {
            --num-columns: 11 !important;
        }
        @include size-below(sm) {
            --num-columns: 9 !important;
        }
        @include size-below(xxs) {
            --num-columns: 7 !important;
        }
    }
</style>
