<script lang="ts">
    import ReplyingTo from "./ReplyingTo.svelte";
    import MessageEntry from "./MessageEntry.svelte";
    import DraftMediaMessage from "./DraftMediaMessage.svelte";
    import { messageContentFromFile } from "../../utils/media";
    import { toastStore } from "../../stores/toast";
    import type {
        ChatSummary,
        EnhancedReplyContext,
        EventWrapper,
        GroupChatSummary,
        Message,
        MessageAction,
        MessageContent,
        Participant,
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
    import { trackEvent } from "../../utils/tracking";
    import { userStore } from "../../stores/user";

    export let controller: ChatController;
    export let blocked: boolean;
    export let preview: boolean;
    export let thread: boolean;
    export let joining: GroupChatSummary | undefined;
    export let chat: ChatSummary;
    export let fileToAttach: MessageContent | undefined;
    export let editingEvent: EventWrapper<Message> | undefined;
    export let replyingTo: EnhancedReplyContext | undefined;
    export let textContent: string | undefined;
    export let participants: Participant[];
    export let blockedUsers: Set<string>;

    const createdUser = getContext<CreatedUser>(currentUserKey);
    const dispatch = createEventDispatcher();
    let messageAction: MessageAction = undefined;
    let messageEntry: MessageEntry;
    $: canSend = canSendMessages(chat, $userStore);

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
                .editMessage(chat, msg!)
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
            const storageRequired = getStorageRequiredForMessage(fileToAttach);
            if ($remainingStorage < storageRequired) {
                dispatch("upgrade", "explain");
                return;
            }

            const msg = controller.createMessage(textContent, fileToAttach);
            controller.api
                .sendMessage(chat, controller.user, mentioned, msg)
                .then((resp) => {
                    if (resp.kind === "success" || resp.kind === "transfer_success") {
                        controller.confirmMessage(msg, resp);
                        if (msg.kind === "message" && msg.content.kind === "crypto_content") {
                            controller.api.refreshAccountBalance(
                                msg.content.transfer.token,
                                createdUser.cryptoAccount
                            );
                        }
                        if (chat.kind === "direct_chat") {
                            trackEvent("sent_direct_message");
                        } else {
                            if (chat.public) {
                                trackEvent("sent_public_group_message");
                            } else {
                                trackEvent("sent_private_group_message");
                            }
                        }
                        if (msg.repliesTo !== undefined) {
                            // double counting here which I think is OK since we are limited to string events
                            trackEvent("replied_to_message");
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

            const nextEventIndex = controller.getNextEventIndex();
            const event = { event: msg, index: nextEventIndex, timestamp: BigInt(Date.now()) };
            controller.sendMessage(event);
        }
    }

    function sendMessage(ev: CustomEvent<[string | undefined, User[]]>) {
        if (!canSend) return;
        let [text, mentioned] = ev.detail;
        if (editingEvent !== undefined) {
            editMessageWithAttachment(text, fileToAttach, editingEvent);
        } else {
            sendMessageWithAttachment(text, mentioned, fileToAttach);
        }
    }

    export function sendMessageWithContent(ev: CustomEvent<[MessageContent, string | undefined]>) {
        sendMessageWithAttachment(ev.detail[1], [], ev.detail[0]);
    }

    function fileSelected(ev: CustomEvent<MessageContent>) {
        controller.attachFile(ev.detail);
    }

    function fileFromDataTransferItems(items: DataTransferItem[]): File | undefined {
        return items.reduce<File | undefined>((res, item) => {
            if (item.kind === "file") {
                return item.getAsFile() || undefined;
            }
            return res;
        }, undefined);
    }

    function messageContentFromDataTransferItemList(items: DataTransferItem[]) {
        const file = fileFromDataTransferItems(items);
        if (file) {
            messageContentFromFile(file)
                .then((content) => controller.attachFile(content))
                .catch((err) => toastStore.showFailureToast(err));
        }
    }

    function onDataTransfer(data: DataTransfer): void {
        const text = data.getData("text/plain") || data.getData("text/uri-list");
        if (text) {
            messageEntry.insertTextAtCaret(text);
        }
        messageContentFromDataTransferItemList([...data.items]);
    }

    function onDrop(e: CustomEvent<DragEvent>) {
        if (e.detail.dataTransfer) {
            onDataTransfer(e.detail.dataTransfer);
            e.detail.preventDefault();
        }
    }

    function onPaste(e: ClipboardEvent) {
        if (e.clipboardData) {
            onDataTransfer(e.clipboardData);
            e.preventDefault();
        }
    }
</script>

<div class="footer">
    <div class="footer-overlay">
        {#if editingEvent === undefined && (replyingTo || fileToAttach !== undefined)}
            <div class="draft-container">
                {#if replyingTo}
                    <ReplyingTo
                        groupChat={chat.kind === "group_chat"}
                        preview={true}
                        on:cancelReply
                        user={controller.user}
                        {replyingTo} />
                {/if}
                {#if fileToAttach !== undefined}
                    {#if fileToAttach.kind === "image_content" || fileToAttach.kind === "audio_content" || fileToAttach.kind === "video_content" || fileToAttach.kind === "file_content" || fileToAttach.kind === "crypto_content"}
                        <DraftMediaMessage content={fileToAttach} />
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
        {fileToAttach}
        {editingEvent}
        {replyingTo}
        {textContent}
        {participants}
        {blockedUsers}
        on:sendMessage={sendMessage}
        on:createPoll
        on:searchChat
        on:tokenTransfer
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
