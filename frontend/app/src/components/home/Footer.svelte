<script lang="ts">
    import ReplyingTo from "./ReplyingTo.svelte";
    import MessageEntry from "./MessageEntry.svelte";
    import DraftMediaMessage from "./DraftMediaMessage.svelte";
    import { toastStore } from "../../stores/toast";
    import EmojiPicker from "./EmojiPicker.svelte";
    import type {
        ChatSummary,
        EnhancedReplyContext,
        EventWrapper,
        GroupChatSummary,
        Member,
        Message,
        MessageAction,
        MessageContent,
        CreatedUser,
        OpenChat,
    } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext } from "svelte";

    const client = getContext<OpenChat>("client");

    export let blocked: boolean;
    export let preview: boolean;
    export let joining: GroupChatSummary | undefined;
    export let chat: ChatSummary;
    export let fileToAttach: MessageContent | undefined;
    export let editingEvent: EventWrapper<Message> | undefined;
    export let replyingTo: EnhancedReplyContext | undefined;
    export let textContent: string | undefined;
    export let members: Member[];
    export let blockedUsers: Set<string>;
    export let user: CreatedUser;
    export let mode: "thread" | "message" = "message";

    const dispatch = createEventDispatcher();

    let messageAction: MessageAction = undefined;
    let messageEntry: MessageEntry;

    $: canSend =
        mode === "thread" ? client.canReplyInThread(chat.id) : client.canSendMessages(chat.id);

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
            client
                .messageContentFromFile(file)
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
                    <ReplyingTo chatId={chat.id} readonly on:cancelReply {user} {replyingTo} />
                {/if}
                {#if fileToAttach !== undefined}
                    {#if fileToAttach.kind === "image_content" || fileToAttach.kind === "audio_content" || fileToAttach.kind === "video_content" || fileToAttach.kind === "file_content" || fileToAttach.kind === "crypto_content"}
                        <DraftMediaMessage content={fileToAttach} />
                    {/if}
                {/if}
            </div>
        {/if}
        {#if messageAction === "emoji"}
            <EmojiPicker {mode} on:emojiSelected={emojiSelected} />
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
        {members}
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
        on:cancelPreview
        on:upgrade
        on:createTestMessages />
</div>

<style lang="scss">
    .footer {
        position: relative;
        flex: 0 0 toRem(60);
    }

    .footer-overlay {
        width: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-content: center;
        align-items: flex-start;
        background-color: var(--entry-bg);
    }

    .draft-container {
        max-width: 80%;
        padding: 0 $sp4 $sp4 $sp4;
    }
</style>
