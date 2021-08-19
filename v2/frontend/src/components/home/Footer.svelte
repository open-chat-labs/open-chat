<script lang="ts">
    import ReplyingTo from "./ReplyingTo.svelte";
    import MessageEntry from "./MessageEntry.svelte";
    import DraftMediaMessage from "./DraftMediaMessage.svelte";
    import Lazy from "../Lazy.svelte";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import type { ActorRefFrom } from "xstate";
    import { messageContentFromFile } from "../../utils/media";
    import { toastStore } from "../../stores/toast";
    import type { MessageContent } from "../../domain/chat/chat";

    export let machine: ActorRefFrom<ChatMachine>;

    const EmojiPicker = () => import("./EmojiPicker.svelte");
    let showEmojiPicker = false;

    function cancelReply() {
        machine.send({ type: "CANCEL_REPLY_TO" });
    }

    function fileSelected(ev: CustomEvent<MessageContent>) {
        machine.send({ type: "ATTACH_FILE", data: ev.detail });
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
            {#if $machine.context.fileToAttach.kind === "media_content"}
                <DraftMediaMessage draft={$machine.context.fileToAttach} />
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
        on:fileSelected={fileSelected}
        on:audioCaptured={fileSelected}
        {machine} />
</div>

<style type="text/scss">
    .pasted-img {
        max-width: 400px;
    }

    .footer {
        position: relative;
    }

    .footer-overlay {
        width: 100%;
        position: absolute;
        bottom: 54px;
        display: flex;
        flex-direction: column;
        @include z-index(footer-overlay);
        @include size-below(xs) {
            bottom: 49px;
        }
    }
</style>
