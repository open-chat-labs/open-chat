<script lang="ts">
    import FileAttacher from "./FileAttacher.svelte";
    import Poll from "svelte-material-icons/Poll.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import { _ } from "svelte-i18n";
    import Smiley from "./Smiley.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Bitcoin from "../icons/Bitcoin.svelte";
    import StickerEmoji from "svelte-material-icons/StickerEmoji.svelte";
    import TrayPlus from "svelte-material-icons/DotsVertical.svelte";
    import TrayRemove from "svelte-material-icons/Close.svelte";
    import { iconSize } from "../../stores/iconSize";
    import { rtlStore } from "../../stores/rtl";
    import { createEventDispatcher, getContext } from "svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import type { MessageAction, MessageContent, OpenChat } from "openchat-client";

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");

    export let messageAction: MessageAction = undefined;
    export let editing: boolean; // are we in edit mode - if so we must restrict what's available
    export let fileToAttach: MessageContent | undefined;
    export let mode: "thread" | "message" = "message";
    export let pollsAllowed: boolean;

    let drawOpen = false;

    $: useDrawer = (mode == "thread" || $mobileWidth) && !editing;
    $: showActions = !useDrawer || (drawOpen && messageAction === undefined);
    $: isDiamond = client.isDiamond;
    $: iconColour = editing ? "var(--button-txt)" : useDrawer ? "var(--txt)" : "var(--icon-txt)";

    export function close() {
        drawOpen = false;
        if (fileToAttach !== undefined) {
            dispatch("clearAttachment");
        }
        messageAction = undefined;
    }

    function toggleAction(action: MessageAction) {
        if (messageAction === action) {
            messageAction = undefined;
            if (fileToAttach !== undefined) {
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

    function toggleEmojiPicker() {
        toggleAction("emoji");
    }

    function toggleDraw() {
        if (drawOpen || fileToAttach !== undefined) {
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
</script>

<svelte:body
    on:click={() => {
        if (drawOpen && messageAction === undefined) {
            drawOpen = false;
        }
    }} />

{#if useDrawer}
    <div class="open-draw" on:click|stopPropagation={toggleDraw}>
        {#if drawOpen || fileToAttach !== undefined}
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
                open={fileToAttach !== undefined}
                on:fileSelected
                on:open={() => (messageAction = "file")}
                on:close={close} />
        </div>
        <div class="send-icp" on:click|stopPropagation={createTokenTransfer}>
            <HoverIcon title={"Send Crypto"}>
                <Bitcoin size={$iconSize} color={iconColour} />
            </HoverIcon>
        </div>
        <div class="gif" on:click|stopPropagation={sendGif}>
            <HoverIcon title={"Attach gif"}>
                <StickerEmoji size={$iconSize} color={iconColour} />
            </HoverIcon>
        </div>
        {#if pollsAllowed}
            <div class="poll" on:click|stopPropagation={createPoll}>
                <HoverIcon title={$_("poll.create")}>
                    <Poll size={$iconSize} color={"var(--icon-txt)"} />
                </HoverIcon>
            </div>
        {/if}
    {/if}
</div>

<style type="text/scss">
    :global(.message-actions.useDrawer.visible .wrapper) {
        background-color: var(--button-bg);
        @include box-shadow(1);
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
            .send-icp,
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
                .send-icp,
                .poll {
                    left: unset;
                    right: toRem(-44);
                }
            }

            &.visible {
                display: block;
                pointer-events: all;

                .emoji {
                    opacity: 1;
                    top: -75px;
                    transition-delay: 200ms;
                }
                .attach {
                    opacity: 1;
                    top: -120px;
                    transition-delay: 150ms;
                }
                .send-icp {
                    opacity: 1;
                    top: -165px;
                    transition-delay: 100ms;
                }
                .gif {
                    opacity: 1;
                    top: -210px;
                    transition-delay: 50ms;
                }
                .poll {
                    opacity: 1;
                    top: -255px;
                }
            }
        }
    }

    .open-draw {
        position: relative;
    }
</style>
