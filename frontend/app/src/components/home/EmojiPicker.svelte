<script lang="ts">
    import "emoji-picker-element";
    import type {
        EmojiClickEvent,
        SkinTone,
        SkinToneChangeEvent,
    } from "emoji-picker-element/shared";
    import { onMount } from "svelte";
    import { currentTheme } from "../../theme/themes";

    interface Props {
        mode?: "message" | "reaction" | "thread";
        onEmojiSelected: (unicode?: string) => void;
        onSkintoneChanged?: (tone: SkinTone) => void;
    }

    let { mode = "message", onEmojiSelected, onSkintoneChanged }: Props = $props();

    onMount(() => {
        const emojiPicker = document.querySelector("emoji-picker");
        if (emojiPicker) {
            emojiPicker.customEmoji = [
                {
                    name: "ThisIsFine",
                    shortcodes: ["this_is_fine"],
                    url: "https://emojis.slackmojis.com/emojis/images/1643514843/8559/this_is_fine.gif?1643514843",
                },
                {
                    name: "PartyParrot",
                    shortcodes: ["party_parrot"],
                    url: "https://emojis.slackmojis.com/emojis/images/1643514742/7500/partyparrot.gif?1643514742",
                },
                {
                    name: "BananaDance",
                    shortcodes: ["banana_dance"],
                    url: "https://emojis.slackmojis.com/emojis/images/1643514066/220/bananadance.gif?1643514066v",
                },
                {
                    name: "Thankyou",
                    shortcodes: ["thankyou"],
                    url: "https://emojis.slackmojis.com/emojis/images/1643514318/2905/thankyou.gif?1643514318",
                },
            ];
        }
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
