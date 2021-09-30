<script lang="ts">
    import ReplyingTo from "./ReplyingTo.svelte";
    import MessageEntry from "./MessageEntry.svelte";
    import DraftMediaMessage from "./DraftMediaMessage.svelte";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import type { ActorRefFrom } from "xstate";
    import { messageContentFromFile } from "../../utils/media";
    import { toastStore } from "../../stores/toast";
    import { chatStore } from "../../stores/chat";
    import type { EventWrapper, Message, MessageContent } from "../../domain/chat/chat";
    import {
        createMessage,
        getMessageContent,
        latestLoadedEventIndex,
        latestLoadedMessageIndex,
    } from "../../domain/chat/chat.utils";
    import { rollbar } from "../../utils/logging";
    import { createEventDispatcher } from "svelte";
    import Loading from "../Loading.svelte";
    const dispatch = createEventDispatcher();

    export let machine: ActorRefFrom<ChatMachine>;

    let showEmojiPicker = false;

    function cancelReply() {
        machine.send({ type: "CANCEL_REPLY_TO" });
    }

    function editMessageWithAttachment(
        textContent: string | null,
        fileToAttach: MessageContent | undefined,
        editingEvent: EventWrapper<Message>
    ) {
        if (textContent || fileToAttach) {
            const msg = {
                ...editingEvent.event,
                content: getMessageContent(textContent ?? undefined, fileToAttach),
            };

            $machine.context.serviceContainer
                .editMessage($machine.context.chatSummary, msg!)
                .then((resp) => {
                    if (resp !== "success") {
                        rollbar.warn("Error response editing", resp);
                        toastStore.showFailureToast("errorEditingMessage");
                        // machine.send({ type: "REMOVE_MESSAGE", data: msg! });
                    }
                })
                .catch((err) => {
                    rollbar.error("Exception sending message", err);
                    toastStore.showFailureToast("errorEditingMessage");
                    // machine.send({ type: "REMOVE_MESSAGE", data: msg! });
                });

            const event = { ...editingEvent, event: msg! };
            machine.send({ type: "SEND_MESSAGE", data: event });

            // chatStore.set({
            //     chatId: $machine.context.chatSummary.chatId,
            //     event: "sending_message",
            // });
        }
    }

    function sendMessageWithAttachment(
        textContent: string | null,
        fileToAttach: MessageContent | undefined
    ) {
        if (textContent || fileToAttach) {
            const nextMessageIndex = (latestLoadedMessageIndex($machine.context.events) ?? -1) + 1;
            const nextEventIndex = (latestLoadedEventIndex($machine.context.events) ?? 0) + 1;

            const msg = createMessage(
                $machine.context.user!.userId,
                nextMessageIndex,
                textContent ?? undefined,
                $machine.context.replyingTo,
                fileToAttach
            );
            dispatch("unconfirmedMessage", msg!.messageId);
            $machine.context.serviceContainer
                .sendMessage($machine.context.chatSummary, $machine.context.user!, msg!)
                .then((resp) => {
                    if (resp.kind === "success") {
                        dispatch("messageConfirmed", msg!.messageId);
                        machine.send({ type: "UPDATE_MESSAGE", data: { candidate: msg!, resp } });
                    } else {
                        rollbar.warn("Error response sending message", resp);
                        toastStore.showFailureToast("errorSendingMessage");
                        machine.send({ type: "REMOVE_MESSAGE", data: msg! });
                    }
                })
                .catch((err) => {
                    toastStore.showFailureToast("errorSendingMessage");
                    machine.send({ type: "REMOVE_MESSAGE", data: msg! });
                    rollbar.error("Exception sending message", err);
                });

            const event = { event: msg!, index: nextEventIndex, timestamp: BigInt(+new Date()) };
            machine.send({
                type: "SEND_MESSAGE",
                data: event,
            });
            chatStore.set({
                chatId: $machine.context.chatSummary.chatId,
                event: "sending_message",
            });
        }
    }

    function sendMessage(ev: CustomEvent<string | null>) {
        if ($machine.context.editingEvent !== undefined) {
            editMessageWithAttachment(
                ev.detail,
                $machine.context.fileToAttach,
                $machine.context.editingEvent
            );
        } else {
            sendMessageWithAttachment(ev.detail, $machine.context.fileToAttach);
        }
    }

    function fileSelected(ev: CustomEvent<MessageContent>) {
        if (ev.detail.kind === "file_content") {
            if ($machine.context.editingEvent !== undefined) {
                editMessageWithAttachment(
                    null,
                    $machine.context.fileToAttach,
                    $machine.context.editingEvent
                );
            } else {
                sendMessageWithAttachment(null, $machine.context.fileToAttach);
            }
        } else {
            machine.send({ type: "ATTACH_FILE", data: ev.detail });
        }
    }

    function messageContentFromDataTransferItemList(items: DataTransferItem[]) {
        const file = items[0]?.getAsFile();
        if (!file) return;

        messageContentFromFile(file)
            .then((content) => machine.send({ type: "ATTACH_FILE", data: content }))
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
        {#if $machine.context.replyingTo}
            <ReplyingTo
                on:cancelReply={cancelReply}
                user={$machine.context.user}
                replyingTo={$machine.context.replyingTo} />
        {/if}
        {#if $machine.context.fileToAttach !== undefined}
            {#if $machine.context.fileToAttach.kind === "image_content" || $machine.context.fileToAttach.kind === "audio_content" || $machine.context.fileToAttach.kind === "video_content"}
                <DraftMediaMessage draft={$machine.context.fileToAttach} />
            {:else if $machine.context.fileToAttach.kind === "cycles_content"}
                <div>Cycle transfer preview</div>
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
        on:sendMessage={sendMessage}
        on:fileSelected={fileSelected}
        on:audioCaptured={fileSelected}
        {machine} />
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
