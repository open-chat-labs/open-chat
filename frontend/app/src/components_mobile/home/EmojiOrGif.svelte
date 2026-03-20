<script lang="ts">
    import { quickReactions } from "@src/stores/quickReactions";
    import { ColourVars, Column, IconButton, Row, transition } from "component-lib";
    import {
        localUpdates,
        type GiphyContent,
        type MessageContext,
        type SelectedEmoji,
    } from "openchat-client";
    // import Backspace from "svelte-material-icons/BackspaceOutline.svelte";
    import Sticker from "svelte-material-icons/StickerEmoji.svelte";
    import Gif from "../icons/Gif.svelte";
    import EmojiPicker from "./EmojiPickerWrapper.svelte";
    import GiphySelector from "./GiphySelector.svelte";
    import { keyboard } from "@src/stores/keyboard.svelte";

    type Tab = "emoji" | "gif";

    interface Props {
        ctx: MessageContext;
        empty: boolean;
        onClose: () => void;
        onBackspace: () => void;
        onEmojiSelected: (emoji: SelectedEmoji) => void;
    }

    let { ctx, onClose, onEmojiSelected }: Props = $props();

    let selected = $state<Tab>("emoji");

    function setTab(t: Tab) {
        console.log("Set tab", t);
        transition(["fade"], () => {
            selected = t;
        });
    }

    function sendGiphy(content: GiphyContent) {
        localUpdates.draftMessages.setAttachment(ctx, content);
        onClose();
    }
</script>

{#snippet toggle(t: Tab, Icon: any)}
    {@const color = selected === t ? ColourVars.primary : ColourVars.textSecondary}
    <IconButton onclick={() => setTab(t)} size={"lg"} padding={"xxs"}>
        {#snippet icon()}
            <Icon {color} />
        {/snippet}
    </IconButton>
{/snippet}

<Column
    supplementalClass={`emoji_wrapper ${selected}`}
    height="fill"
    overflow="visible"
    maxHeight={keyboard.height > 0 ? `${keyboard.height}px` : "auto"}>
    <div class="emoji-gif-wrapper">
        <Row
            gap="sm"
            width="hug"
            padding={["md", "zero", "md", "sm"]}
            mainAxisAlignment={"spaceBetween"}
            crossAxisAlignment={"center"}>
            {@render toggle("emoji", Sticker)}
            {@render toggle("gif", Gif)}
        </Row>
    </div>
    <!-- TODO what to do with backspace here? -->
    <!-- this backspace should be used when users don't want to switch back to
         keyboard to remove an emoji that they've incorrectly selected -->
    <!-- <div class="backspace-wrapper">
        <IconButton disabled={empty} onclick={onBackspace}>
            {#snippet icon()}
                <Backspace color={empty ? ColourVars.textTertiary : ColourVars.textSecondary} />
            {/snippet}
        </IconButton>
    </div> -->
    {#if selected === "emoji"}
        <EmojiPicker
            searchInputPadding={true}
            {onEmojiSelected}
            onSkintoneChanged={(tone) => quickReactions.reload(tone)}
            supportCustom={false}
            mode={"reaction"} />
    {:else}
        <GiphySelector onSend={sendGiphy} />
    {/if}
</Column>

<style lang="scss">
    :global {
        .emoji_wrapper {
            height: 100%;
            position: relative;
            animation: fade-in 400ms ease-out forwards;

            &.emoji:before {
                content: "";
                position: absolute;
                left: 0;
                bottom: calc(-1 * var(--device-nav-height));
                width: 100%;
                // 2.75 depends on the size of the emoji, if it changes, this
                // may not be accurate height calculation.
                height: calc(2.75rem + var(--device-nav-height));
                background-color: var(--background-2);
                border-radius: var(--rad-lg) var(--rad-lg) 0 0;
            }

            .backspace-wrapper,
            .emoji-gif-wrapper {
                top: 0;
                z-index: 1;
                position: absolute;
                background-color: var(--background-1);
            }

            .backspace-wrapper {
                right: 0;
            }

            .emoji-gif-wrapper {
                left: 0;
            }
        }
    }
</style>
