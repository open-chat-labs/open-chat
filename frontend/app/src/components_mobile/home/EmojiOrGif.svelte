<script lang="ts">
    import { quickReactions } from "@src/stores/quickReactions";
    import {
        Body,
        ColourVars,
        Column,
        IconButton,
        Row,
        transition,
        type ColourVarKeys,
    } from "component-lib";
    import {
        localUpdates,
        type GiphyContent,
        type MessageContext,
        type SelectedEmoji,
    } from "openchat-client";
    import Backspace from "svelte-material-icons/BackspaceOutline.svelte";
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

    let { ctx, empty, onClose, onEmojiSelected, onBackspace }: Props = $props();

    let selected = $state<Tab>("emoji");

    function setTab(t: Tab) {
        transition(["fade"], () => {
            selected = t;
        });
    }

    function sendGiphy(content: GiphyContent) {
        localUpdates.draftMessages.setAttachment(ctx, content);
        onClose();
    }
</script>

{#snippet toggle(label: string, t: Tab, Icon: any)}
    {@const colourKey: ColourVarKeys = selected === t ? "primary" : "textSecondary"}
    {@const color = selected === t ? ColourVars.primary : ColourVars.textSecondary}
    <Row width={"hug"} gap={"xs"} crossAxisAlignment={"center"} onClick={() => setTab(t)}>
        <Icon size={"1.25rem"} {color} />
        <Body width={"hug"} colour={colourKey} fontWeight={"bold"}>
            {label}
        </Body>
    </Row>
{/snippet}

<Column
    supplementalClass="emoji_wrapper"
    height="fill"
    overflow="visible"
    maxHeight={keyboard.maxHeight > 0 ? `${keyboard.maxHeight}px` : "auto"}>
    <!-- <Row
        padding={["sm", "lg", "zero", "lg"]}
        mainAxisAlignment={"spaceBetween"}
        crossAxisAlignment={"center"}>
        <Row gap={"xxl"}>
            {@render toggle("Reactions", "emoji", Sticker)}
            {@render toggle("Send GIFs", "gif", Gif)}
        </Row>
        <IconButton disabled={empty} onclick={onBackspace}>
            {#snippet icon()}
                <Backspace color={empty ? ColourVars.textTertiary : ColourVars.textSecondary} />
            {/snippet}
        </IconButton>
    </Row> -->
    {#if selected === "emoji"}
        <EmojiPicker
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
            animation: fade-in 400ms ease-out forwards;

            &:before {
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
        }
    }
</style>
