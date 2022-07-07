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
    import { canReplyInThread, canSendMessages } from "../../domain/chat/chat.utils";
    import Loading from "../Loading.svelte";
    import type { UserSummary } from "../../domain/user/user";
    import Reload from "../Reload.svelte";
    import { _ } from "svelte-i18n";
    import { userStore } from "../../stores/user";
    import { createEventDispatcher } from "svelte";

    export let blocked: boolean;
    export let preview: boolean;
    export let joining: GroupChatSummary | undefined;
    export let chat: ChatSummary;
    export let fileToAttach: MessageContent | undefined;
    export let editingEvent: EventWrapper<Message> | undefined;
    export let replyingTo: EnhancedReplyContext | undefined;
    export let textContent: string | undefined;
    export let participants: Participant[];
    export let blockedUsers: Set<string>;
    export let user: UserSummary;
    export let mode: "thread" | "message" = "message";

    const dispatch = createEventDispatcher();

    let messageAction: MessageAction = undefined;
    let messageEntry: MessageEntry;
    $: canSend = mode === "thread" ? canReplyInThread(chat) : canSendMessages(chat, $userStore);

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
                .then((content) => dispatch("fileSelected", content))
                .catch((err) => toastStore.showFailureToast(err));
        }
    }

    function onDataTransfer(data: DataTransfer): void {
        const text = data.getData("text/plain") || data.getData("text/uri-list");
        if (text) {
            messageEntry.replaceSelection(text);
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
            messageEntry.saveSelection();
            onDataTransfer(e.clipboardData);
            e.preventDefault();
        }
    }

    function emojiSelected(ev: CustomEvent<string>) {
        messageEntry?.replaceSelection(ev.detail);
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
                        {user}
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
                <svelte:component this={picker.default} {mode} on:emojiSelected={emojiSelected} />
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
        {mode}
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
        {chat}
        on:sendMessage
        on:cancelEditEvent
        on:setTextContent
        on:startTyping
        on:stopTyping
        on:createPoll
        on:searchChat
        on:tokenTransfer
        on:attachGif
        on:clearAttachment
        on:fileSelected
        on:audioCaptured
        on:joinGroup
        on:cancelPreview />
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
