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
    export let editing: boolean; // are we in edit mode - if so we must restrict what's available

    let drawOpen = false;

    $: fileToAttach = controller.fileToAttach;
    $: useDrawer = $mobileWidth && !editing;
    $: showActions = !useDrawer || (drawOpen && messageAction === undefined);

    $: iconColour = editing ? "var(--button-txt)" : "var(--icon-txt)";

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

    function createTokenTransfer() {
        dispatch("tokenTransfer");
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

<svelte:body
    on:click={() => {
        if (drawOpen && messageAction === undefined) {
            drawOpen = false;
        }
    }} />

{#if useDrawer}
    <div class="open-draw" on:click|stopPropagation={toggleDraw}>
        {#if drawOpen || $fileToAttach !== undefined}
            <HoverIcon>
                <TrayRemove size={$iconSize} color={iconColour} />
            </HoverIcon>
        {:else}
            <HoverIcon>
                <TrayPlus size={$iconSize} color={iconColour} />
            </HoverIcon>
        {/if}
    </div>
{/if}

<div class:visible={showActions} class="message-actions" class:useDrawer>
    <div class="emoji" on:click|stopPropagation={toggleEmojiPicker}>
        {#if messageAction === "emoji"}
            <HoverIcon>
                <Close size={$iconSize} color={iconColour} />
            </HoverIcon>
        {:else}
            <HoverIcon>
                <Smiley color={iconColour} />
            </HoverIcon>
        {/if}
    </div>
    {#if !editing}
        <div class="attach">
            <FileAttacher
                open={$fileToAttach !== undefined}
                on:fileSelected
                on:open={() => (messageAction = "file")}
                on:close={close} />
        </div>
        <div class="send-icp" on:click|stopPropagation={createTokenTransfer}>
            <HoverIcon title={"Send Crypto"}>
                <SwapHorizontal size={$iconSize} color={iconColour} />
            </HoverIcon>
        </div>
        <div class="gif" on:click|stopPropagation={sendGif}>
            <HoverIcon title={"Attach gif"}>
                <StickerEmoji size={$iconSize} color={iconColour} />
            </HoverIcon>
        </div>
    {/if}
</div>

<style type="text/scss">
    :global(.message-actions.useDrawer.visible .wrapper) {
        background-color: var(--entry-bg);
        @include box-shadow(1);
    }

    .emoji,
    .attach,
    .open-draw,
    .gif,
    .send-icp {
        flex: 0 0 15px;
    }

    .message-actions {
        position: relative;
        display: flex;
        opacity: 0;
        align-items: center;
        transition: opacity 0s ease-in-out;
        transition-delay: 300s;

        &.visible {
            opacity: 1;
            transition-delay: 0s;
        }

        &.useDrawer {
            pointer-events: none;

            .emoji,
            .attach,
            .gif,
            .send-icp {
                top: -18px;
                left: toRem(-38);
                opacity: 0;
                position: absolute;
                transition: top 200ms ease-in, opacity 200ms ease-in;
            }

            &.visible {
                display: block;
                pointer-events: all;

                .emoji {
                    opacity: 1;
                    top: -75px;
                    transition-delay: 150ms;
                }
                .attach {
                    opacity: 1;
                    top: -120px;
                    transition-delay: 100ms;
                }
                .send-icp {
                    opacity: 1;
                    top: -165px;
                    transition-delay: 50ms;
                }
                .gif {
                    opacity: 1;
                    top: -210px;
                }
            }
        }
    }

    .open-draw {
        position: relative;
    }
</style>
