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
        MessageAction,
        MessageContent,
    } from "../../domain/chat/chat";
    import { canSendMessages } from "../../domain/chat/chat.utils";
    import { getMessageContent, getStorageRequiredForMessage } from "../../domain/chat/chat.utils";
    import { rollbar } from "../../utils/logging";
    import Loading from "../Loading.svelte";
    import type { ChatController } from "../../fsm/chat.controller";
    import type { CreatedUser, User } from "../../domain/user/user";
    import Reload from "../Reload.svelte";
    import { _ } from "svelte-i18n";
    import { remainingStorage } from "../../stores/storage";
    import { createEventDispatcher, getContext } from "svelte";
    import { currentUserKey } from "../../fsm/home.controller";

    export let controller: ChatController;
    export let blocked: boolean;
    export let preview: boolean;
    export let joining: GroupChatSummary | undefined;

    const createdUser = getContext<CreatedUser>(currentUserKey);
    const dispatch = createEventDispatcher();
    let messageAction: MessageAction = undefined;
    let messageEntry: MessageEntry;
    $: chat = controller.chat;
    $: fileToAttach = controller.fileToAttach;
    $: editingEvent = controller.editingEvent;
    $: replyingTo = controller.replyingTo;
    $: canSend = canSendMessages($chat);

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
            controller.sendMessage(event);
        }
    }

    function sendMessageWithAttachment(
        textContent: string | undefined,
        mentioned: User[],
        fileToAttach: MessageContent | undefined
    ) {
        if (!canSend) return;
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
                    if (resp.kind === "success" || resp.kind === "transfer_success") {
                        controller.confirmMessage(msg, resp);
                        if (msg.kind === "message" && msg.content.kind === "crypto_content") {
                            controller.api.refreshAccountBalance(createdUser.icpAccount);
                        }
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
            controller.sendMessage(event);
        }
    }

    function sendMessage(ev: CustomEvent<[string | undefined, User[]]>) {
        if (!canSend) return;
        let [text, mentioned] = ev.detail;
        if ($editingEvent !== undefined) {
            editMessageWithAttachment(text, $fileToAttach, $editingEvent);
        } else {
            sendMessageWithAttachment(text, mentioned, $fileToAttach);
        }
    }

    export function sendMessageWithContent(ev: CustomEvent<MessageContent>) {
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
                        groupChat={$chat.kind === "group_chat"}
                        preview={true}
                        on:cancelReply={cancelReply}
                        user={controller.user}
                        replyingTo={$replyingTo} />
                {/if}
                {#if $fileToAttach !== undefined}
                    {#if $fileToAttach.kind === "image_content" || $fileToAttach.kind === "audio_content" || $fileToAttach.kind === "video_content" || $fileToAttach.kind === "file_content" || $fileToAttach.kind === "crypto_content"}
                        <DraftMediaMessage content={$fileToAttach} />
                    {/if}
                {/if}
            </div>
        {/if}
        {#if messageAction === "emoji"}
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
        bind:messageAction
        on:paste={onPaste}
        on:drop={onDrop}
        {canSend}
        {preview}
        {blocked}
        {joining}
        on:sendMessage={sendMessage}
        on:createPoll
        on:searchChat
        on:icpTransfer
        on:attachGif
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
</style>
