<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import type Picker from "emoji-picker-element/picker";
    import "emoji-picker-element";
    import { getCurrentThemeName } from "../../theme/themes";
    import { customEmojis } from "../../utils/emojis";

    export let mode: "message" | "reaction" | "thread" = "message";

    const dispatch = createEventDispatcher();
    let theme: string = getCurrentThemeName();
    let picker: Picker;

    onMount(() => {
        document.querySelector("emoji-picker")?.addEventListener("emoji-click", (event) => {
            console.log("emoji: ", event.detail);
            dispatch("emojiSelected", event.detail.unicode ?? event.detail.name);
        });
        picker.customEmoji = customEmojis;
    });
</script>

<emoji-picker
    bind:this={picker}
    class:message={mode === "message"}
    class:reaction={mode === "reaction"}
    class:thread={mode === "thread"}
    class:dark={theme === "dark"}
    class:light={theme === "light" || theme === "original"} />

<style type="text/scss">
    emoji-picker {
        width: 100%;
        --num-columns: 17;
        --emoji-padding: 0.3rem;
        --emoji-size: 1.8rem;

        @include size-below(xl) {
            --num-columns: 15 !important;
        }
        @include size-below(md) {
            --num-columns: 12 !important;
        }
        @include size-below(sm) {
            --num-columns: 11 !important;
        }
        @include size-below(xs) {
            --num-columns: 9 !important;
        }
        @include size-below(xxs) {
            --num-columns: 7 !important;
        }

        &.reaction,
        &.thread {
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
        }
    }
</style>
