<script lang="ts">
    import ReplyingTo from "./ReplyingTo.svelte";
    import MessageEntry from "./MessageEntry.svelte";
    import DraftMediaMessage from "./DraftMediaMessage.svelte";
    import Lazy from "../Lazy.svelte";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import type { ActorRefFrom } from "xstate";
    import { messageContentFromFile } from "../../utils/media";
    import { toastStore } from "../../stores/toast";
    import { chatStore } from "../../stores/chat";
    import type { DirectMessage, GroupMessage, MessageContent } from "../../domain/chat/chat";
    import {
        createDirectMessage,
        createGroupMessage,
        latestLoadedEventIndex,
        latestLoadedMessageIndex,
    } from "../../domain/chat/chat.utils";
    import { rollbar } from "../../utils/logging";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();

    export let machine: ActorRefFrom<ChatMachine>;

    const EmojiPicker = () => import("./EmojiPicker.svelte");
    let showEmojiPicker = false;

    function cancelReply() {
        machine.send({ type: "CANCEL_REPLY_TO" });
    }

    function sendMessageWithAttachment(
        textContent: string | null,
        fileToAttach: MessageContent | undefined
    ) {
        if (textContent || fileToAttach) {
            const nextIndex = latestLoadedMessageIndex($machine.context.chatSummary) + 1;
            let msg: GroupMessage | DirectMessage | undefined;
            if ($machine.context.chatSummary.kind === "group_chat") {
                msg = createGroupMessage(
                    $machine.context.user!.userId,
                    nextIndex,
                    textContent ?? undefined,
                    $machine.context.replyingTo,
                    fileToAttach
                );
            }
            if ($machine.context.chatSummary.kind === "direct_chat") {
                msg = createDirectMessage(
                    nextIndex,
                    textContent ?? undefined,
                    $machine.context.replyingTo,
                    fileToAttach
                );
            }
            dispatch("unconfirmedMessage", msg!.messageId);
            $machine.context.serviceContainer
                .sendMessage($machine.context.chatSummary, $machine.context.user!, msg!)
                .then((resp) => {
                    if (resp.kind === "send_message_success") {
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

            machine.send({ type: "SEND_MESSAGE", data: { message: msg!, index: nextIndex } });
            chatStore.set({
                chatId: $machine.context.chatSummary.chatId,
                event: "sending_message",
            });
        }
    }

    function sendMessage(ev: CustomEvent<string | null>) {
        sendMessageWithAttachment(ev.detail, $machine.context.fileToAttach);
    }

    function fileSelected(ev: CustomEvent<MessageContent>) {
        if (ev.detail.kind === "file_content") {
            sendMessageWithAttachment(null, ev.detail);
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
                identity={$machine.context.serviceContainer.getIdentity()}
                on:cancelReply={cancelReply}
                user={$machine.context.user}
                replyingTo={$machine.context.replyingTo} />
        {/if}
        {#if $machine.context.fileToAttach !== undefined}
            {#if $machine.context.fileToAttach.kind === "media_content"}
                <DraftMediaMessage
                    identity={$machine.context.serviceContainer.getIdentity()}
                    draft={$machine.context.fileToAttach} />
            {:else if $machine.context.fileToAttach.kind === "cycles_content"}
                <div>Cycle transfer preview</div>
            {/if}
        {/if}
        {#if showEmojiPicker}
            <Lazy component={EmojiPicker} />
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
    .footer {
        position: relative;
    }

    .footer-overlay {
        width: 100%;
        display: flex;
        flex-direction: column;
    }
</style>
