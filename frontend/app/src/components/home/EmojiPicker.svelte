<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import "emoji-picker-element";
    import { currentTheme } from "../../theme/themes";

    export let mode: "message" | "reaction" | "thread" = "message";

    const dispatch = createEventDispatcher();

    onMount(() => {
        const emojiPicker = document.querySelector("emoji-picker");

        emojiPicker?.addEventListener("emoji-click", (event) => {
            dispatch("emojiSelected", event.detail.unicode);
        });

        emojiPicker?.addEventListener("skin-tone-change", (event) => {
            dispatch("skintoneChanged", event.detail.skinTone);
        });
    });
</script>

<emoji-picker
    class:message={mode === "message"}
    class:reaction={mode === "reaction"}
    class:thread={mode === "thread"}
    class:dark={$currentTheme.mode === "dark"}
    class:light={$currentTheme.mode === "light"} />

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
