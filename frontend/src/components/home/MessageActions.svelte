<script lang="ts">
    import FileAttacher from "./FileAttacher.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import Smiley from "./Smiley.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import SwapHorizontal from "svelte-material-icons/SwapHorizontal.svelte";
    import StickerEmoji from "svelte-material-icons/StickerEmoji.svelte";
    import TrayPlus from "svelte-material-icons/TrayPlus.svelte";
    import TrayRemove from "svelte-material-icons/TrayRemove.svelte";
    import { iconSize } from "../../stores/iconSize";
    import { createEventDispatcher } from "svelte";
    import type { ChatController } from "../../fsm/chat.controller";
    import { mobileWidth } from "../../stores/screenDimensions";
    import type { MessageAction } from "../../domain/chat/chat";

    const dispatch = createEventDispatcher();

    export let controller: ChatController;
    export let messageAction: MessageAction = undefined;

    let drawOpen = false;

    $: chat = controller.chat;
    $: fileToAttach = controller.fileToAttach;

    $: useDrawer = $mobileWidth;
    $: showActions = !useDrawer || (drawOpen && messageAction === undefined);

    export function close() {
        drawOpen = false;
        if (fileToAttach !== undefined) {
            controller.clearAttachment();
        }
        messageAction = undefined;
    }

    function toggleAction(action: MessageAction) {
        if (messageAction === action) {
            messageAction = undefined;
            if ($fileToAttach !== undefined) {
                controller.clearAttachment();
            }
        } else {
            messageAction = action;
        }
    }

    function createICPTransfer() {
        dispatch("icpTransfer", BigInt(0));
        drawOpen = false;
    }

    function toggleEmojiPicker() {
        toggleAction("emoji");
    }

    function toggleDraw() {
        if (drawOpen || $fileToAttach !== undefined) {
            close();
        } else {
            drawOpen = true;
        }
    }

    function sendGif() {
        dispatch("attachGif", "");
        drawOpen = false;
    }
</script>

{#if useDrawer}
    <div class="open-draw" on:click={toggleDraw}>
        {#if drawOpen || $fileToAttach !== undefined}
            <HoverIcon>
                <TrayRemove size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        {:else}
            <HoverIcon>
                <TrayPlus size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        {/if}
    </div>
{/if}

<div class:visible={showActions} class="message-actions" class:useDrawer>
    <div class="emoji" on:click={toggleEmojiPicker}>
        {#if messageAction === "emoji"}
            <HoverIcon>
                <Close size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        {:else}
            <HoverIcon>
                <Smiley />
            </HoverIcon>
        {/if}
    </div>
    <div class="attach">
        <FileAttacher
            open={$fileToAttach !== undefined}
            on:fileSelected
            on:open={() => (messageAction = "file")}
            on:close={close} />
    </div>
    <div class="send-icp" on:click={createICPTransfer}>
        <HoverIcon title={"Send Crypto"}>
            <SwapHorizontal size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </div>
    <div class="gif" on:click={sendGif}>
        <HoverIcon title={"Attach gif"}>
            <StickerEmoji size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </div>
</div>

<style type="text/scss">
    .message-actions {
        display: none;
        align-items: center;
        transition: top 200ms ease-in-out;

        &.useDrawer {
            position: absolute;
            flex-direction: column;
            top: 0px;
            background-color: var(--entry-bg);

            &.visible {
                top: -149px;
            }
        }

        &.visible {
            display: flex;
        }
    }
    .emoji,
    .attach,
    .open-draw,
    .gif,
    .send-icp {
        flex: 0 0 15px;
    }

    .open-draw {
        position: relative;
    }
</style>
