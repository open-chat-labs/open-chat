<script lang="ts">
    import FileAttacher from "./FileAttacher.svelte";
    import { fade, fly } from "svelte/transition";
    import HoverIcon from "../HoverIcon.svelte";
    import Smiley from "./Smiley.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import SwapHorizontal from "svelte-material-icons/SwapHorizontal.svelte";
    import TrayPlus from "svelte-material-icons/TrayPlus.svelte";
    import TrayRemove from "svelte-material-icons/TrayRemove.svelte";
    import { iconSize } from "../../stores/iconSize";
    import { createEventDispatcher } from "svelte";
    import type { ChatController } from "../../fsm/chat.controller";
    import { ScreenWidth, screenWidth } from "../../stores/screenDimensions";
    import type { MessageAction } from "../../domain/chat/chat";

    const dispatch = createEventDispatcher();

    export let controller: ChatController;
    export let messageAction: MessageAction = undefined;

    let drawOpen = false;

    $: chat = controller.chat;
    $: fileToAttach = controller.fileToAttach;
    $: mobile = $screenWidth === ScreenWidth.ExtraSmall && $chat.kind === "direct_chat";

    export function close() {
        drawOpen = false;
        messageAction = undefined;
    }

    function toggleAction(action: MessageAction) {
        if (messageAction === action) {
            messageAction = undefined;
        } else {
            messageAction = action;
        }
    }

    function toggleEmojiPicker() {
        toggleAction("emoji");
    }

    function toggleCryptoTransfer() {
        toggleAction("transfer");
        if (messageAction === "transfer") {
            controller.createDraftICPTransfer();
        }
    }

    function clearAttachment() {}

    function toggleDraw() {
        if (drawOpen) {
            close();
        } else {
            drawOpen = true;
        }
    }
</script>

{#if mobile}
    <div class="open-draw" on:click={toggleDraw}>
        {#if drawOpen}
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

{#if !mobile || (drawOpen && messageAction === undefined)}
    <div in:fly={{ y: 100, duration: 200 }} class="message-actions" class:mobile>
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
                on:close={clearAttachment} />
        </div>
        {#if $chat.kind === "direct_chat"}
            <div class="send-icp" on:click={toggleCryptoTransfer}>
                {#if messageAction === "transfer"}
                    <HoverIcon>
                        <Close size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                {:else}
                    <HoverIcon title={"Send Crypto"}>
                        <SwapHorizontal size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                {/if}
            </div>
        {/if}
    </div>
{/if}

<style type="text/scss">
    .message-actions {
        display: flex;
        align-items: center;

        &.mobile {
            flex-direction: column;
            position: absolute;
            top: -110px;
            background-color: var(--entry-bg);
        }
    }
    .emoji,
    .attach,
    .open-draw,
    .send-icp {
        flex: 0 0 15px;
    }

    .open-draw {
        position: relative;
    }
</style>
