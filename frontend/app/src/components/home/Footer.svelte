<script lang="ts">
    import { _ } from "svelte-i18n";
    import ReplyingTo from "./ReplyingTo.svelte";
    import MessageEntry from "./MessageEntry.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import DraftMediaMessage from "./DraftMediaMessage.svelte";
    import { toastStore } from "../../stores/toast";
    import EmojiPicker from "./EmojiPicker.svelte";
    import type {
        ChatSummary,
        EnhancedReplyContext,
        EventWrapper,
        Message,
        MessageAction,
        CreatedUser,
        OpenChat,
        MultiUserChat,
        AttachmentContent,
    } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import ModalContent from "../ModalContent.svelte";
    import { iconSize } from "../../stores/iconSize";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    export let blocked: boolean;
    export let preview: boolean;
    export let lapsed: boolean;
    export let joining: MultiUserChat | undefined;
    export let chat: ChatSummary;
    export let attachment: AttachmentContent | undefined;
    export let editingEvent: EventWrapper<Message> | undefined;
    export let replyingTo: EnhancedReplyContext | undefined;
    export let textContent: string | undefined;
    export let user: CreatedUser;
    export let mode: "thread" | "message" = "message";
    export let externalContent: boolean = false;

    const dispatch = createEventDispatcher();

    let messageAction: MessageAction = undefined;
    let messageEntry: MessageEntry;

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
                .then((content) => {
                    let permission = client.contentTypeToPermission(content.kind);
                    if (client.canSendMessage(chat.id, mode, permission)) {
                        dispatch("fileSelected", content);
                    } else {
                        const errorMessage = i18nKey("permissions.notPermitted", {
                            permission: $_(`permissions.threadPermissions.${permission}`),
                        });
                        toastStore.showFailureToast(errorMessage);
                    }
                })
                .catch((err) => toastStore.showFailureToast(i18nKey(err)));
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

{#if messageAction === "emoji"}
    <div class={`emoji-overlay ${mode}`}>
        <ModalContent hideFooter hideHeader fill>
            <span slot="body">
                <div class="emoji-header">
                    <h4><Translatable resourceKey={i18nKey("pickEmoji")} /></h4>
                    <span title={$_("close")} class="close-emoji">
                        <HoverIcon onclick={() => (messageAction = undefined)}>
                            <Close size={$iconSize} color={"var(--icon-txt)"} />
                        </HoverIcon>
                    </span>
                </div>
                <EmojiPicker on:emojiSelected={emojiSelected} {mode} />
            </span>
            <span slot="footer" />
        </ModalContent>
    </div>
{/if}

<div class="footer">
    <div class="footer-overlay">
        {#if editingEvent === undefined && (replyingTo || attachment !== undefined)}
            <div class="draft-container">
                {#if replyingTo}
                    <ReplyingTo readonly on:cancelReply {user} {replyingTo} />
                {/if}
                {#if attachment !== undefined}
                    <DraftMediaMessage content={attachment} />
                {/if}
            </div>
        {/if}
    </div>
    <MessageEntry
        bind:this={messageEntry}
        bind:messageAction
        on:paste={onPaste}
        on:drop={onDrop}
        {externalContent}
        {mode}
        {preview}
        {lapsed}
        {blocked}
        {joining}
        {attachment}
        {editingEvent}
        {replyingTo}
        {textContent}
        {chat}
        on:sendMessage
        on:cancelEditEvent
        on:setTextContent
        on:startTyping
        on:stopTyping
        on:createPoll
        on:searchChat
        on:tokenTransfer
        on:createPrizeMessage
        on:createP2PSwapMessage
        on:attachGif
        on:makeMeme
        on:clearAttachment
        on:fileSelected
        on:audioCaptured
        on:joinGroup
        on:upgrade
        on:createTestMessages />
</div>

<style lang="scss">
    :global(body.witch .middle .footer) {
        @include z-index("footer");
    }

    :global(.emoji-overlay .modal-content) {
        border: var(--bw) solid var(--bd);
    }

    :global(.emoji-overlay.thread .modal-content) {
        width: 100%;
        border-radius: var(--modal-rd) var(--modal-rd) 0 0;
    }

    .footer {
        position: relative;
        flex: 0 0 toRem(60);
        padding-bottom: env(safe-area-inset-bottom);
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

    .emoji-overlay {
        position: absolute;
        bottom: toRem(70);
        left: toRem(10);
        width: 100%;
        @include z-index("footer-overlay");

        @include mobile() {
            left: 0;
            bottom: toRem(60);
        }

        .emoji-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: $sp3 $sp4;
            background-color: var(--section-bg);

            .close-emoji {
                flex: 0 0 20px;
            }
        }

        &.thread {
            bottom: toRem(60);
            left: 0;
        }
    }

    .draft-container {
        max-width: 80%;
        padding: 0 $sp4 $sp4 $sp4;
    }
</style>
