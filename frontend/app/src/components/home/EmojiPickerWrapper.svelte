<script lang="ts">
    import type { SkinTone } from "emoji-picker-element/shared";
    import { customEmojis, type SelectedEmoji } from "openchat-client";
    import EmojiPicker from "./EmojiPicker.svelte";

    interface Props {
        mode?: "message" | "reaction" | "thread";
        onEmojiSelected: (selected: SelectedEmoji) => void;
        onSkintoneChanged?: (tone: SkinTone) => void;
        supportCustom?: boolean;
    }

    let {
        mode = "message",
        onEmojiSelected,
        onSkintoneChanged,
        supportCustom = false,
    }: Props = $props();

    function onEmojiSelectedInternal(selected: SelectedEmoji) {
        console.log("Feature clicked", selected);
        onEmojiSelected(selected);
    }
</script>

<EmojiPicker
    {mode}
    onEmojiSelected={onEmojiSelectedInternal}
    {onSkintoneChanged}
    customEmojis={supportCustom ? customEmojis : undefined} />
