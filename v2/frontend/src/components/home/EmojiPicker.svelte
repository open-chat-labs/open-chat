<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import { emojiStore } from "../../stores/emoji";
    import "emoji-picker-element";
    import { getCurrentThemeName } from "../../theme/themes";

    export let mode: "message" | "reaction" = "message";

    const dispatch = createEventDispatcher();
    let theme: string = getCurrentThemeName();

    onMount(() => {
        document.querySelector("emoji-picker")?.addEventListener("emoji-click", (event) => {
            if (mode === "reaction") {
                dispatch("emojiSelected", event.detail.unicode);
            } else {
                emojiStore.set(event.detail.unicode);
            }
        });
    });
</script>

<emoji-picker
    class:message={mode === "message"}
    class:reaction={mode === "reaction"}
    class:dark={theme === "batman"}
    class:light={theme === "light"} />

<style type="text/scss">
    emoji-picker {
        width: 100%;
        --num-columns: 12;
        --emoji-padding: 0.3rem;
        @include size-below(xs) {
            --num-columns: 6;
        }
    }
</style>
