<script lang="ts">
    import { quickReactions } from "@src/stores/quickReactions";
    import {
        BodySmall,
        ColourVars,
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

    type Tab = "emoji" | "gif";

    interface Props {
        ctx: MessageContext;
        onClose: () => void;
        onEmojiSelected: (emoji: SelectedEmoji) => void;
    }

    let { ctx, onClose, onEmojiSelected }: Props = $props();

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
        <Icon size={"1rem"} {color} />
        <BodySmall width={"hug"} colour={colourKey} fontWeight={"bold"}>
            {label}
        </BodySmall>
    </Row>
{/snippet}

<Row
    padding={["sm", "lg", "zero", "lg"]}
    mainAxisAlignment={"spaceBetween"}
    crossAxisAlignment={"center"}>
    <Row gap={"xxl"}>
        {@render toggle("Reactions", "emoji", Sticker)}
        {@render toggle("Send GIFs", "gif", Gif)}
    </Row>
    <IconButton onclick={onClose}>
        {#snippet icon()}
            <Backspace color={ColourVars.textSecondary} />
        {/snippet}
    </IconButton>
</Row>
{#if selected === "emoji"}
    <EmojiPicker
        {onEmojiSelected}
        onSkintoneChanged={(tone) => quickReactions.reload(tone)}
        supportCustom={false}
        mode={"reaction"} />
{:else}
    <GiphySelector onSend={sendGiphy} />
{/if}
