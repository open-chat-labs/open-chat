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
    import { mobileWidth } from "../../stores/screenDimensions";
    import {
        type AttachmentContent,
        type MessageAction,
        type MessagePermission,
    } from "openchat-client";

    interface Props {
        permittedMessages: Map<MessagePermission, boolean>;
        messageAction?: MessageAction;
        editing: boolean; // are we in edit mode - if so we must restrict what's available
        attachment: AttachmentContent | undefined;
        mode?: "thread" | "message";
        onClearAttachment: () => void;
        onTokenTransfer: (args: { ledger?: string; amount?: bigint }) => void;
        onCreatePrizeMessage: () => void;
        onCreateP2PSwapMessage: () => void;
        onCreatePoll: () => void;
        onAttachGif: (search: string) => void;
        onMakeMeme: () => void;
        onFileSelected: (content: AttachmentContent) => void;
    }

    let {
        permittedMessages,
        messageAction = $bindable(undefined),
        editing,
        attachment,
        mode = "message",
        onClearAttachment,
        onTokenTransfer,
        onCreatePrizeMessage,
        onCreateP2PSwapMessage,
        onCreatePoll,
        onAttachGif,
        onMakeMeme,
        onFileSelected,
    }: Props = $props();

    let drawOpen = $state(false);

    export function close() {
        drawOpen = false;
        if (attachment !== undefined) {
            onClearAttachment();
        }
        messageAction = undefined;
    }

    function createTokenTransfer(e: Event) {
        e.stopPropagation();
        onTokenTransfer({});
        drawOpen = false;
    }

    function createPrizeMessage(e: Event) {
        e.stopPropagation();
        onCreatePrizeMessage();
        drawOpen = false;
    }

    function createP2PSwapMessage(e: Event) {
        e.stopPropagation();
        onCreateP2PSwapMessage();
        drawOpen = false;
    }

    function openEmojiPicker(e: Event) {
        e.stopPropagation();
        messageAction = "emoji";
    }

    function openFilePicker() {
        messageAction = "file";
    }

    function toggleDraw(e: Event) {
        e.stopPropagation();
        if (showClose) {
            close();
        } else {
            drawOpen = true;
        }
    }

    function createPoll(e: Event) {
        e.stopPropagation();
        onCreatePoll();
        drawOpen = false;
    }

    function sendGif(e: Event) {
        e.stopPropagation();
        onAttachGif("");
        drawOpen = false;
    }

    function makeMeme(e: Event) {
        e.stopPropagation();
        onMakeMeme();
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
    let useDrawer = $derived(!editing);
    let narrow = $derived(mode == "thread" || $mobileWidth);
    let showActions = $derived(!useDrawer || drawOpen);
    let iconColour = $derived(
        editing ? "var(--button-txt)" : useDrawer ? "var(--txt)" : "var(--icon-txt)",
    );
    let supportedActions = $derived(buildListOfActions(permittedMessages, messageAction, narrow));
    let showClose = $derived(drawOpen || attachment !== undefined || messageAction === "emoji");
</script>

<svelte:body
    onclick={() => {
        if (drawOpen && messageAction === undefined) {
            drawOpen = false;
        }
    }} />

{#if !narrow}
    {#if permittedMessages.get("text") || messageAction === "file"}
        <div class="emoji" onclick={openEmojiPicker}>
            <HoverIcon title={$_("pickEmoji")}>
                <Smiley color={"var(--icon-txt)"} />
            </HoverIcon>
        </div>
    {/if}

    {#if !editing && (permittedMessages.get("file") || permittedMessages.get("image") || permittedMessages.get("video"))}
        <div class="attach">
            <FileAttacher {onFileSelected} onOpen={openFilePicker} />
        </div>
    {/if}
{/if}

{#if useDrawer}
    <div class="open-draw" onclick={toggleDraw}>
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
        <div style={`${supportedActions.get("emoji")}`} class="emoji" onclick={openEmojiPicker}>
            <HoverIcon title={$_("pickEmoji")}>
                <Smiley color={iconColour} />
            </HoverIcon>
        </div>
    {/if}
    {#if !editing}
        {#if supportedActions.has("attach")}
            <div style={`${supportedActions.get("attach")}`} class="attach">
                <FileAttacher {onFileSelected} onOpen={openFilePicker} />
            </div>
        {/if}
        {#if supportedActions.has("crypto")}
            <div
                style={`${supportedActions.get("crypto")}`}
                class="send-icp"
                onclick={createTokenTransfer}>
                <HoverIcon title={"Send Crypto"}>
                    <Bitcoin size={$iconSize} color={"var(--button-txt)"} />
                </HoverIcon>
            </div>
        {/if}
        {#if supportedActions.has("giphy")}
            <div style={`${supportedActions.get("giphy")}`} class="gif" onclick={sendGif}>
                <HoverIcon title={"Attach gif"}>
                    <StickerEmoji size={$iconSize} color={iconColour} />
                </HoverIcon>
            </div>
        {/if}
        {#if supportedActions.has("meme")}
            <div style={`${supportedActions.get("meme")}`} class="meme" onclick={makeMeme}>
                <HoverIcon title={"Meme Fighter"}>
                    <MemeFighter size={$iconSize} color={iconColour} />
                </HoverIcon>
            </div>
        {/if}
        {#if supportedActions.has("poll")}
            <div style={`${supportedActions.get("poll")}`} class="poll" onclick={createPoll}>
                <HoverIcon title={$_("poll.create")}>
                    <Poll size={$iconSize} color={"var(--icon-txt)"} />
                </HoverIcon>
            </div>
        {/if}
        {#if supportedActions.has("prize")}
            <div
                style={`${supportedActions.get("prize")}`}
                class="prize"
                onclick={createPrizeMessage}>
                <HoverIcon title={"Create prize"}>
                    <Gift size={$iconSize} color={iconColour} />
                </HoverIcon>
            </div>
        {/if}
        {#if supportedActions.has("swap")}
            <div
                style={`${supportedActions.get("swap")}`}
                class="swap"
                onclick={createP2PSwapMessage}>
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
