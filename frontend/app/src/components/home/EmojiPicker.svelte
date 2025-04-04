<script lang="ts">
    import { onMount } from "svelte";
    import "emoji-picker-element";
    import { currentTheme } from "../../theme/themes";
    import type {
        EmojiClickEvent,
        SkinTone,
        SkinToneChangeEvent,
    } from "emoji-picker-element/shared";

    interface Props {
        mode?: "message" | "reaction" | "thread";
        onEmojiSelected: (unicode?: string) => void;
        onSkintoneChanged?: (tone: SkinTone) => void;
    }

    let { mode = "message", onEmojiSelected, onSkintoneChanged }: Props = $props();

    onMount(() => {
        const emojiPicker = document.querySelector("emoji-picker");
        emojiPicker?.addEventListener("emoji-click", onClick);
        emojiPicker?.addEventListener("skin-tone-change", skinToneChanged);
        return () => {
            emojiPicker?.removeEventListener("emoji-click", onClick);
        };
    });

    function skinToneChanged(ev: SkinToneChangeEvent) {
        onSkintoneChanged?.(ev.detail.skinTone);
    }

    function onClick(ev: EmojiClickEvent) {
        onEmojiSelected(ev.detail.unicode);
    }
</script>

<emoji-picker
    class:message={mode === "message"}
    class:reaction={mode === "reaction"}
    class:thread={mode === "thread"}
    class:dark={$currentTheme.mode === "dark"}
    class:light={$currentTheme.mode === "light"}></emoji-picker>

<style lang="scss">
    emoji-picker {
        width: 100%;
        --emoji-padding: 0.3rem;
        --emoji-size: 1.8rem;
        --background: transparent;

        --border-size: 0;
        --border-color: var(--bd);
        --input-font-color: var(--txt);
        --input-border-color: var(--bd);
        --input-padding: 8px 16px;

        --num-columns: 12 !important;

        @include size-below(sm) {
            --num-columns: 11 !important;
        }
        @include size-below(xs) {
            --num-columns: 9 !important;
        }
        @include size-below(xxs) {
            --num-columns: 7 !important;
        }

        &.thread {
            --num-columns: 10 !important;
        }
    }
</style>
