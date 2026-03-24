<script lang="ts">
    import type { SkinTone } from "emoji-picker-element/shared";
    import { customEmojis, type SelectedEmoji } from "openchat-client";
    import EmojiPicker from "./EmojiPicker.svelte";

    interface Props {
        mode?: "message" | "reaction" | "thread";
        searchInputPadding?: boolean;
        onEmojiSelected: (selected: SelectedEmoji) => void;
        onSkintoneChanged?: (tone: SkinTone) => void;
        supportCustom?: boolean;
    }

    let {
        mode = "message",
        searchInputPadding,
        onEmojiSelected,
        onSkintoneChanged,
        supportCustom = false,
    }: Props = $props();

    function onEmojiSelectedInternal(selected: SelectedEmoji) {
        onEmojiSelected(selected);
    }
</script>

<EmojiPicker
    {mode}
    {searchInputPadding}
    onEmojiSelected={onEmojiSelectedInternal}
    {onSkintoneChanged}
    customEmojis={supportCustom ? customEmojis : undefined} />
