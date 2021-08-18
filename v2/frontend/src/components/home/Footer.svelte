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

    function onPaste(e: ClipboardEvent) {
        if (e.clipboardData) {
            const imageFile = [...e.clipboardData.items]
                .find((i) => {
                    return /image/.test(i.type);
                })
                ?.getAsFile();
            if (!imageFile) return;

            messageContentFromFile(imageFile)
                .then((content) => machine.send({ type: "ATTACH_FILE", data: content }))
                .catch((err) => toastStore.showFailureToast(err));
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
        on:fileSelected={fileSelected}
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
