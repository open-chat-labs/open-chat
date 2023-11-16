<script lang="ts">
    import FileAttacher from "./FileAttacher.svelte";
    import Poll from "svelte-material-icons/Poll.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import { _ } from "svelte-i18n";
    import Smiley from "./Smiley.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Gift from "svelte-material-icons/GiftOutline.svelte";
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

    $: useDrawer = (mode == "thread" || $mobileWidth) && !editing;
    $: showActions = !useDrawer || (drawOpen && messageAction === undefined);
    $: iconColour = editing ? "var(--button-txt)" : useDrawer ? "var(--txt)" : "var(--icon-txt)";
    $: supportedActions = buildListOfActions(permittedMessages, messageAction);

    export function close() {
        drawOpen = false;
        if (attachment !== undefined) {
            dispatch("clearAttachment");
        }
        messageAction = undefined;
    }

    function toggleAction(action: MessageAction) {
        if (messageAction === action) {
            messageAction = undefined;
            if (attachment !== undefined) {
                dispatch("clearAttachment");
            }
        } else {
            messageAction = action;
        }
    }

    function createTokenTransfer() {
        dispatch("tokenTransfer");
        drawOpen = false;
    }

    function createPrizeMessage() {
        dispatch("createPrizeMessage");
        drawOpen = false;
    }

    function toggleEmojiPicker() {
        toggleAction("emoji");
    }

    function toggleDraw() {
        if (drawOpen || attachment !== undefined) {
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

    function buildListOfActions(
        permissions: Map<MessagePermission, boolean>,
        messageAction: MessageAction
    ): Map<string, number> {
        const actions = new Map<string, number>();
        if (permissions.get("text") || messageAction === "file") {
            actions.set("emoji", actions.size);
        }
        if (permissions.get("file") || permissions.get("image") || permissions.get("video")) {
            actions.set("attach", actions.size);
        }
        if (permissions.get("crypto")) {
            actions.set("crypto", actions.size);
        }
        if (permissions.get("giphy")) {
            actions.set("giphy", actions.size);
        }
        if (permissions.get("memeFighter")) {
            actions.set("meme", actions.size);
        }
        if (permissions.get("poll")) {
            actions.set("poll", actions.size);
        }
        if (permissions.get("prize")) {
            actions.set("prize", actions.size);
        }
        return actions;
    }

    function cssVars(key: string): string {
        return `--top: ${top(supportedActions.get(key))}px; --transition-delay: ${delay(
            supportedActions.get(key)
        )}ms`;
    }

    function top(i: number | undefined): number {
        if (i === undefined) return 0;
        return -75 - i * 45;
    }

    function delay(i: number | undefined): number {
        if (i === undefined) return 0;
        const increment = 50;
        const total = supportedActions.size * increment;
        return total - (i + 1) * increment;
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
        {#if drawOpen || attachment !== undefined}
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
            style={`${cssVars("emoji")}`}
            class="emoji"
            on:click|stopPropagation={toggleEmojiPicker}>
            {#if messageAction === "emoji"}
                <HoverIcon title={$_("close")}>
                    <Close size={$iconSize} color={iconColour} />
                </HoverIcon>
            {:else}
                <HoverIcon title={$_("pickEmoji")}>
                    <Smiley color={iconColour} />
                </HoverIcon>
            {/if}
        </div>
    {/if}
    {#if !editing}
        {#if supportedActions.has("attach")}
            <div class="attach" style={`${cssVars("attach")}`}>
                <FileAttacher
                    open={attachment !== undefined}
                    on:fileSelected
                    on:open={() => (messageAction = "file")}
                    on:close={close} />
            </div>
        {/if}
        {#if supportedActions.has("crypto")}
            <div
                style={`${cssVars("crypto")}`}
                class="send-icp"
                on:click|stopPropagation={createTokenTransfer}>
                <HoverIcon title={"Send Crypto"}>
                    <Bitcoin size={$iconSize} color={iconColour} />
                </HoverIcon>
            </div>
        {/if}
        {#if supportedActions.has("giphy")}
            <div style={`${cssVars("giphy")}`} class="gif" on:click|stopPropagation={sendGif}>
                <HoverIcon title={"Attach gif"}>
                    <StickerEmoji size={$iconSize} color={iconColour} />
                </HoverIcon>
            </div>
        {/if}
        {#if supportedActions.has("meme")}
            <div style={`${cssVars("meme")}`} class="meme" on:click|stopPropagation={makeMeme}>
                <HoverIcon title={"Meme Fighter"}>
                    <MemeFighter size={$iconSize} color={iconColour} />
                </HoverIcon>
            </div>
        {/if}
        {#if supportedActions.has("poll")}
            <div style={`${cssVars("poll")}`} class="poll" on:click|stopPropagation={createPoll}>
                <HoverIcon title={$_("poll.create")}>
                    <Poll size={$iconSize} color={"var(--icon-txt)"} />
                </HoverIcon>
            </div>
        {/if}
        {#if supportedActions.has("prize")}
            <div
                style={`${cssVars("prize")}`}
                class="prize"
                on:click|stopPropagation={createPrizeMessage}>
                <HoverIcon title={"Create prize"}>
                    <Gift size={$iconSize} color={iconColour} />
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
            .poll {
                top: -18px;
                left: toRem(-44);
                opacity: 0;
                position: absolute;
                transition: top 200ms ease-in, opacity 200ms ease-in;
                @include z-index("action-list");
            }

            &.rtl {
                .emoji,
                .attach,
                .gif,
                .meme,
                .send-icp,
                .prize,
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
