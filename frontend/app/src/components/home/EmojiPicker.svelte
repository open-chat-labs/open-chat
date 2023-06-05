<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import "emoji-picker-element";
    import { getCurrentThemeName } from "../../theme/themes";

    export let mode: "message" | "reaction" | "thread" = "message";

    const dispatch = createEventDispatcher();
    let theme: string = getCurrentThemeName();

    onMount(() => {
        document.querySelector("emoji-picker")?.addEventListener("emoji-click", (event) => {
            dispatch("emojiSelected", event.detail.unicode);
        });
    });
</script>

<emoji-picker
    class:message={mode === "message"}
    class:reaction={mode === "reaction"}
    class:thread={mode === "thread"}
    class:dark={theme === "dark"}
    class:light={theme === "light" || theme === "original"} />

<style lang="scss">
    emoji-picker {
        width: 100%;
        --num-columns: 24;
        --emoji-padding: 0.3rem;
        --emoji-size: 1.8rem;
        --background: transparent;

        --border-size: 0;
        --border-color: var(--bd);
        --input-font-color: var(--txt);
        --input-border-color: var(--bd);
        --input-padding: 8px 16px;

        @include size-below(xxl) {
            --num-columns: 17 !important;
        }

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
