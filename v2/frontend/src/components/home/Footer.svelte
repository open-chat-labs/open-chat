<script lang="ts">
    import ReplyingTo from "./ReplyingTo.svelte";
    import MessageEntry from "./MessageEntry.svelte";
    import DraftMediaMessage from "./DraftMediaMessage.svelte";
    import { messageContentFromFile } from "../../utils/media";
    import { toastStore } from "../../stores/toast";
    import type { EventWrapper, Message, MessageContent } from "../../domain/chat/chat";
    import { getMessageContent } from "../../domain/chat/chat.utils";
    import { rollbar } from "../../utils/logging";
    import { createEventDispatcher } from "svelte";
    import Loading from "../Loading.svelte";
    import type { ChatController } from "../../fsm/chat.controller";
    const dispatch = createEventDispatcher();

    export let controller: ChatController;
    export let blocked: boolean;

    let showEmojiPicker = false;
    $: chat = controller.chat;
    $: fileToAttach = controller.fileToAttach;
    $: editingEvent = controller.editingEvent;
    $: replyingTo = controller.replyingTo;

    function cancelReply() {
        controller.cancelReply();
    }

    function editMessageWithAttachment(
        textContent: string | null,
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
        textContent: string | null,
        fileToAttach: MessageContent | undefined
    ) {
        if (textContent || fileToAttach) {
            const nextEventIndex = controller.getNextEventIndex();

            const msg = controller.createMessage(textContent, fileToAttach);
            controller.api
                .sendMessage($chat, controller.user, msg!)
                .then((resp) => {
                    if (resp.kind === "success") {
                        controller.updateMessage(msg, resp);
                    } else {
                        rollbar.warn("Error response sending message", resp);
                        toastStore.showFailureToast("errorSendingMessage");
                        controller.removeMessage(msg.messageId, controller.user.userId);
                        // note this is not really marking the message confirmed so much as removing it from the unconfirmed list
                        dispatch("messageConfirmed", msg!.messageId);
                    }
                })
                .catch((err) => {
                    toastStore.showFailureToast("errorSendingMessage");
                    controller.removeMessage(msg.messageId, controller.user.userId);
                    rollbar.error("Exception sending message", err);
                    // note this is not really marking the message confirmed so much as removing it from the unconfirmed list
                });

            const event = { event: msg!, index: nextEventIndex, timestamp: BigInt(Date.now()) };
            controller.sendMessage(event, controller.user.userId);
        }
    }

    function sendMessage(ev: CustomEvent<string | null>) {
        if ($editingEvent !== undefined) {
            editMessageWithAttachment(ev.detail, $fileToAttach, $editingEvent);
        } else {
            sendMessageWithAttachment(ev.detail, $fileToAttach);
        }
    }

    function fileSelected(ev: CustomEvent<MessageContent>) {
        if (ev.detail.kind === "file_content") {
            if ($editingEvent !== undefined) {
                editMessageWithAttachment(null, $fileToAttach, $editingEvent);
            } else {
                sendMessageWithAttachment(null, $fileToAttach);
            }
        } else {
            controller.attachFile(ev.detail);
        }
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
            e.preventDefault();
        }
    }
</script>

<div class="footer">
    <div class="footer-overlay">
        {#if $replyingTo}
            <ReplyingTo
                on:cancelReply={cancelReply}
                user={controller.user}
                replyingTo={$replyingTo} />
        {/if}
        {#if $fileToAttach !== undefined}
            {#if $fileToAttach.kind === "image_content" || $fileToAttach.kind === "audio_content" || $fileToAttach.kind === "video_content"}
                <DraftMediaMessage draft={$fileToAttach} />
            {:else if $fileToAttach.kind === "crypto_content"}
                <div>Crypto transfer preview</div>
            {/if}
        {/if}
        {#if showEmojiPicker}
            {#await import("./EmojiPicker.svelte")}
                <div class="loading-emoji"><Loading /></div>
            {:then picker}
                <svelte:component this={picker.default} />
            {/await}
        {/if}
    </div>
    <MessageEntry
        bind:showEmojiPicker
        on:paste={onPaste}
        on:drop={onDrop}
        {blocked}
        on:sendMessage={sendMessage}
        on:fileSelected={fileSelected}
        on:audioCaptured={fileSelected}
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
    }
</style>
