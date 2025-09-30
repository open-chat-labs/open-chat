<script lang="ts">
    import { fileFromDataTransferItems } from "@src/utils/datatransfer";
    import {
        iconSize,
        messageContextsEqual,
        subscribe,
        type AttachmentContent,
        type ChatSummary,
        type CreatedUser,
        type EnhancedReplyContext,
        type EphemeralMessageEvent,
        type EventWrapper,
        type Message,
        type MessageAction,
        type MessageContext,
        type MultiUserChat,
        type OpenChat,
        type SelectedEmoji,
        type User,
    } from "openchat-client";
    import { getContext, onMount, tick } from "svelte";
    import { _ } from "svelte-i18n";
    import Close from "svelte-material-icons/Close.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { toastStore } from "../../stores/toast";
    import EphemeralMessage from "../bots/EphemeralMessage.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Translatable from "../Translatable.svelte";
    import DraftMediaMessage from "./DraftMediaMessage.svelte";
    import EmojiPicker from "./EmojiPickerWrapper.svelte";
    import MessageEntry from "./MessageEntry.svelte";
    import ReplyingTo from "./ReplyingTo.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        blocked: boolean;
        preview: boolean;
        lapsed: boolean;
        joining: MultiUserChat | undefined;
        chat: ChatSummary;
        attachment: AttachmentContent | undefined;
        editingEvent: EventWrapper<Message> | undefined;
        replyingTo: EnhancedReplyContext | undefined;
        textContent: string | undefined;
        user: CreatedUser;
        mode?: "thread" | "message";
        externalContent?: boolean;
        messageContext: MessageContext;
        onFileSelected: (content: AttachmentContent) => void;
        onCancelReply: () => void;
        onSetTextContent: (txt?: string) => void;
        onStartTyping: () => void;
        onStopTyping: () => void;
        onCancelEdit: () => void;
        onSendMessage: (args: [string | undefined, User[], boolean]) => void;
        onClearAttachment: () => void;
        onTokenTransfer: (args: { ledger?: string; amount?: bigint }) => void;
        onCreatePrizeMessage?: () => void;
        onCreateP2PSwapMessage: () => void;
        onCreatePoll: () => void;
        onAttachGif: (search: string) => void;
        onMakeMeme: () => void;
    }

    let {
        blocked,
        preview,
        lapsed,
        joining,
        chat,
        attachment,
        editingEvent,
        replyingTo,
        textContent,
        user,
        mode = "message",
        externalContent = false,
        messageContext,
        onFileSelected,
        onCancelReply,
        onSetTextContent,
        onCancelEdit,
        onStartTyping,
        onStopTyping,
        onSendMessage,
        onClearAttachment,
        onTokenTransfer,
        onCreatePrizeMessage,
        onCreateP2PSwapMessage,
        onCreatePoll,
        onAttachGif,
        onMakeMeme,
    }: Props = $props();

    let ephemeralMessageEvent = $state<EphemeralMessageEvent>();
    let messageAction: MessageAction = $state(undefined);
    //@ts-ignore
    let messageEntry: MessageEntry;

    onMount(() => {
        const unsubs = [subscribe("ephemeralMessage", onEphemeralMessage)];
        return () => {
            unsubs.forEach((u) => u());
        };
    });

    async function onEphemeralMessage(ev: EphemeralMessageEvent) {
        if (ev.scope.kind !== "chat_scope") return;
        if (!messageContextsEqual(messageContext, ev.scope)) return;
        if (ephemeralMessageEvent !== undefined) {
            ephemeralMessageEvent = undefined;
            await tick();
        }
        ephemeralMessageEvent = ev;
    }

    function messageContentFromDataTransferItemList(items: DataTransferItem[]) {
        const file = fileFromDataTransferItems(items);
        if (file) {
            client
                .messageContentFromFile(file)
                .then((content) => {
                    let permission = client.contentTypeToPermission(content.kind);
                    if (client.canSendMessage(chat.id, mode, permission)) {
                        onFileSelected(content);
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

    function onPaste(e: ClipboardEvent) {
        if (e.clipboardData) {
            messageEntry.saveSelection();
            onDataTransfer(e.clipboardData);
            e.preventDefault();
        }
    }

    function emojiSelected(selected: SelectedEmoji) {
        messageEntry?.insertEmoji(selected);
    }

    $effect(() => {
        if (
            ephemeralMessageEvent !== undefined &&
            ephemeralMessageEvent.scope.kind === "chat_scope" &&
            !messageContextsEqual(messageContext, ephemeralMessageEvent.scope)
        ) {
            ephemeralMessageEvent = undefined;
        }
    });
</script>

{#if messageAction === "emoji"}
    <div class={`emoji-overlay ${mode}`}>
        <ModalContent hideFooter hideHeader fill>
            {#snippet body()}
                <span>
                    <div class="emoji-header">
                        <h4><Translatable resourceKey={i18nKey("pickEmoji")} /></h4>
                        <span title={$_("close")} class="close-emoji">
                            <HoverIcon onclick={() => (messageAction = undefined)}>
                                <Close size={$iconSize} color={"var(--icon-txt)"} />
                            </HoverIcon>
                        </span>
                    </div>
                    <EmojiPicker onEmojiSelected={emojiSelected} {mode} supportCustom={false} />
                </span>
            {/snippet}
            {#snippet footer()}
                <span></span>
            {/snippet}
        </ModalContent>
    </div>
{/if}

<div class="footer">
    <div class="footer-overlay">
        {#if ephemeralMessageEvent !== undefined}
            <EphemeralMessage
                onClose={() => (ephemeralMessageEvent = undefined)}
                event={ephemeralMessageEvent} />
        {/if}
        {#if editingEvent === undefined && (replyingTo || attachment !== undefined)}
            <div class="draft-container">
                {#if replyingTo}
                    <ReplyingTo readonly {onCancelReply} {user} {replyingTo} />
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
        {onPaste}
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
        {messageContext}
        {onSendMessage}
        {onCancelEdit}
        {onSetTextContent}
        {onStartTyping}
        {onStopTyping}
        {onCreatePoll}
        {onTokenTransfer}
        {onCreatePrizeMessage}
        {onCreateP2PSwapMessage}
        {onAttachGif}
        {onMakeMeme}
        {onClearAttachment}
        {onFileSelected} />
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
