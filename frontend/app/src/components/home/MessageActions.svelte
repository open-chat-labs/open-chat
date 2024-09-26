<script lang="ts">
    import FileAttacher from "./FileAttacher.svelte";
    import Poll from "svelte-material-icons/Poll.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import { _ } from "svelte-i18n";
    import Smiley from "./Smiley.svelte";
    import Gift from "svelte-material-icons/GiftOutline.svelte";
    import SwapIcon from "svelte-material-icons/SwapHorizontal.svelte";
    import Bitcoin from "../icons/Bitcoin.svelte";
    import MemeFighter from "../icons/MemeFighter.svelte";
    import StickerEmoji from "svelte-material-icons/StickerEmoji.svelte";
    import TrayPlus from "svelte-material-icons/DotsVertical.svelte";
    import TrayRemove from "svelte-material-icons/Close.svelte";
    import { iconSize } from "../../stores/iconSize";
    import { rtlStore } from "../../stores/rtl";
    import { createEventDispatcher } from "svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import type { AttachmentContent, MessageAction, MessagePermission } from "openchat-client";

    const dispatch = createEventDispatcher();

    export let permittedMessages: Map<MessagePermission, boolean>;
    export let messageAction: MessageAction = undefined;
    export let editing: boolean; // are we in edit mode - if so we must restrict what's available
    export let attachment: AttachmentContent | undefined;
    export let mode: "thread" | "message" = "message";

    let drawOpen = false;

    $: useDrawer = !editing;
    $: narrow = mode == "thread" || $mobileWidth;
    $: showActions = !useDrawer || drawOpen;
    $: iconColour = editing ? "var(--button-txt)" : useDrawer ? "var(--txt)" : "var(--icon-txt)";
    $: supportedActions = buildListOfActions(permittedMessages, messageAction, narrow);
    $: showClose = drawOpen || attachment !== undefined || messageAction === "emoji";

    export function close() {
        drawOpen = false;
        if (attachment !== undefined) {
            dispatch("clearAttachment");
        }
        messageAction = undefined;
    }

    function createTokenTransfer() {
        dispatch("tokenTransfer");
        drawOpen = false;
    }

    function createPrizeMessage() {
        dispatch("createPrizeMessage");
        drawOpen = false;
    }

    function createP2PSwapMessage() {
        dispatch("createP2PSwapMessage");
        drawOpen = false;
    }

    function openEmojiPicker() {
        messageAction = "emoji";
    }

    function openFilePicker() {
        messageAction = "file";
    }

    function toggleDraw() {
        if (showClose) {
            close();
        } else {
            drawOpen = true;
        }
    }

    function createPoll() {
        dispatch("createPoll");
        drawOpen = false;
    }

    function sendGif() {
        dispatch("attachGif", "");
        drawOpen = false;
    }

    function makeMeme() {
        dispatch("makeMeme");
        drawOpen = false;
    }

    function cssValues(index: number): string {
        return `--top: ${top(index)}px; --transition-delay: ${delay(index)}ms`;
    }

    function buildListOfActions(
        permissions: Map<MessagePermission, boolean>,
        messageAction: MessageAction,
        includeAll: boolean,
    ): Map<string, string> {
        let index = -1;
        const actions = new Map<string, string>();
        if (includeAll) {
            if (permissions.get("text") || messageAction === "file") {
                actions.set("emoji", cssValues(++index));
            }
            if (permissions.get("file") || permissions.get("image") || permissions.get("video")) {
                actions.set("attach", cssValues(++index));
            }
        }
        if (permissions.get("crypto")) {
            actions.set("crypto", cssValues(++index));
        }
        if (permissions.get("giphy")) {
            actions.set("giphy", cssValues(++index));
        }
        if (permissions.get("memeFighter")) {
            actions.set("meme", cssValues(++index));
        }
        if (permissions.get("poll")) {
            actions.set("poll", cssValues(++index));
        }
        if (permissions.get("prize")) {
            actions.set("prize", cssValues(++index));
        }
        if (permissions.get("p2pSwap")) {
            actions.set("swap", cssValues(++index));
        }
        return actions;
    }

    function top(i: number | undefined): number {
        if (i === undefined) return 0;
        return -55 - i * 45;
    }

    function delay(i: number | undefined): number {
        if (i === undefined) return 0;
        const increment = 50;
        const total = i * increment;
        return total - (i + 1) * increment;
    }
</script>

<svelte:body
    on:click={() => {
        if (drawOpen && messageAction === undefined) {
            drawOpen = false;
        }
    }} />

{#if !narrow}
    {#if permittedMessages.get("text") || messageAction === "file"}
        <div class="emoji" on:click|stopPropagation={openEmojiPicker}>
            <HoverIcon title={$_("pickEmoji")}>
                <Smiley color={"var(--icon-txt)"} />
            </HoverIcon>
        </div>
    {/if}

    {#if !editing && (permittedMessages.get("file") || permittedMessages.get("image") || permittedMessages.get("video"))}
        <div class="attach">
            <FileAttacher on:fileSelected on:open={openFilePicker} />
        </div>
    {/if}
{/if}

{#if useDrawer}
    <div class="open-draw" on:click|stopPropagation={toggleDraw}>
        {#if showClose}
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

<div class:visible={showActions} class="message-actions" class:useDrawer class:rtl={$rtlStore}>
    {#if supportedActions.has("emoji")}
        <div
            style={`${supportedActions.get("emoji")}`}
            class="emoji"
            on:click|stopPropagation={openEmojiPicker}>
            <HoverIcon title={$_("pickEmoji")}>
                <Smiley color={iconColour} />
            </HoverIcon>
        </div>
    {/if}
    {#if !editing}
        {#if supportedActions.has("attach")}
            <div style={`${supportedActions.get("attach")}`} class="attach">
                <FileAttacher on:fileSelected on:open={openFilePicker} />
            </div>
        {/if}
        {#if supportedActions.has("crypto")}
            <div
                style={`${supportedActions.get("crypto")}`}
                class="send-icp"
                on:click|stopPropagation={createTokenTransfer}>
                <HoverIcon title={"Send Crypto"}>
                    <Bitcoin size={$iconSize} color={"var(--button-txt)"} />
                </HoverIcon>
            </div>
        {/if}
        {#if supportedActions.has("giphy")}
            <div
                style={`${supportedActions.get("giphy")}`}
                class="gif"
                on:click|stopPropagation={sendGif}>
                <HoverIcon title={"Attach gif"}>
                    <StickerEmoji size={$iconSize} color={iconColour} />
                </HoverIcon>
            </div>
        {/if}
        {#if supportedActions.has("meme")}
            <div
                style={`${supportedActions.get("meme")}`}
                class="meme"
                on:click|stopPropagation={makeMeme}>
                <HoverIcon title={"Meme Fighter"}>
                    <MemeFighter size={$iconSize} color={iconColour} />
                </HoverIcon>
            </div>
        {/if}
        {#if supportedActions.has("poll")}
            <div
                style={`${supportedActions.get("poll")}`}
                class="poll"
                on:click|stopPropagation={createPoll}>
                <HoverIcon title={$_("poll.create")}>
                    <Poll size={$iconSize} color={"var(--icon-txt)"} />
                </HoverIcon>
            </div>
        {/if}
        {#if supportedActions.has("prize")}
            <div
                style={`${supportedActions.get("prize")}`}
                class="prize"
                on:click|stopPropagation={createPrizeMessage}>
                <HoverIcon title={"Create prize"}>
                    <Gift size={$iconSize} color={iconColour} />
                </HoverIcon>
            </div>
        {/if}
        {#if supportedActions.has("swap")}
            <div
                style={`${supportedActions.get("swap")}`}
                class="swap"
                on:click|stopPropagation={createP2PSwapMessage}>
                <HoverIcon title={$_("p2pSwap.builderTitle")}>
                    <SwapIcon size={$iconSize} color={iconColour} />
                </HoverIcon>
            </div>
        {/if}
    {/if}
</div>

<style lang="scss">
    :global(.message-actions.useDrawer.visible .wrapper) {
        background-color: var(--button-bg);
        @include box-shadow(1);

        &:hover {
            background-color: var(--button-hv);
        }
    }

    :global(.message-actions.useDrawer.visible .wrapper path) {
        fill: var(--button-txt);
    }

    :global(.message-actions.useDrawer.visible .wrapper ellipse) {
        fill: var(--button-txt);
    }

    .emoji,
    .attach,
    .open-draw,
    .gif,
    .meme,
    .poll,
    .prize,
    .swap,
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
            .meme,
            .send-icp,
            .prize,
            .swap,
            .poll {
                top: -18px;
                left: toRem(-40);
                opacity: 0;
                position: absolute;
                transition:
                    top 200ms ease-in,
                    opacity 200ms ease-in;
                @include z-index("action-list");

                @include mobile() {
                    left: toRem(-44);
                }
            }

            &.rtl {
                .emoji,
                .attach,
                .gif,
                .meme,
                .send-icp,
                .prize,
                .swap,
                .poll {
                    left: unset;
                    right: toRem(-44);
                }
            }

            &.visible {
                display: block;
                pointer-events: all;

                .emoji,
                .attach,
                .send-icp,
                .gif,
                .meme,
                .poll,
                .swap,
                .prize {
                    top: var(--top);
                    transition-delay: var(--transition-delay);
                    opacity: 1;
                }
            }
        }
    }

    .open-draw {
        position: relative;
    }
</style>
