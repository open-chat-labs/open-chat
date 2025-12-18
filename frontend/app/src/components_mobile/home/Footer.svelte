<script lang="ts">
    import { fileFromDataTransferItems } from "@src/utils/datatransfer";
    import { Column } from "component-lib";
    import {
        messageContextsEqual,
        subscribe,
        type AttachmentContent,
        type ChatSummary,
        type CreatedUser,
        type EnhancedReplyContext,
        type EphemeralMessageEvent,
        type EventWrapper,
        type Message,
        type MessageContext,
        type OpenChat,
        type User,
    } from "openchat-client";
    import { getContext, onMount, tick } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import { toastStore } from "../../stores/toast";
    import EphemeralMessage from "../bots/EphemeralMessage.svelte";
    import DraftMediaMessage from "./DraftMediaMessage.svelte";
    import MessageEntry from "./MessageEntry.svelte";
    import ReplyingTo from "./ReplyingTo.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        blocked: boolean;
        preview: boolean;
        lapsed: boolean;
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
        onMakeMeme: () => void;
    }

    let {
        blocked,
        preview,
        lapsed,
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
        onMakeMeme,
    }: Props = $props();

    let ephemeralMessageEvent = $state<EphemeralMessageEvent>();
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

<div class={`footer ${mode}`}>
    <div class="footer-overlay">
        {#if ephemeralMessageEvent !== undefined}
            <EphemeralMessage
                onClose={() => (ephemeralMessageEvent = undefined)}
                event={ephemeralMessageEvent} />
        {/if}
        {#if editingEvent === undefined && (replyingTo || attachment !== undefined)}
            <Column padding={"lg"}>
                {#if replyingTo}
                    <ReplyingTo readonly {onCancelReply} {user} {replyingTo} />
                {/if}
                {#if attachment !== undefined}
                    <DraftMediaMessage ctx={messageContext} content={attachment} />
                {/if}
            </Column>
        {/if}
    </div>
    <MessageEntry
        bind:this={messageEntry}
        {onPaste}
        {externalContent}
        {mode}
        {preview}
        {lapsed}
        {blocked}
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
        {onMakeMeme}
        {onClearAttachment}
        {onFileSelected} />
</div>

<style lang="scss">
    :global(body.witch .middle .footer) {
        @include z-index("footer");
    }

    .footer {
        position: relative;
        flex: 0 0 toRem(60);
        width: 100%;
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
</style>
