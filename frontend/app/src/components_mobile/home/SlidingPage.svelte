<script lang="ts">
    import { swipe, type SwipeDirection } from "component-lib";
    import { publish } from "openchat-client";
    import type { Snippet } from "svelte";
    import { expoInOut } from "svelte/easing";
    import { fly } from "svelte/transition";

    interface Props {
        children: Snippet;
    }

    let { children }: Props = $props();

    function onSwipe(dir: SwipeDirection) {
        if (dir === "right") {
            publish("closeModalPage");
        }
    }
</script>

<div
    use:swipe={{ onSwipe }}
    transition:fly={{ duration: 500, easing: expoInOut, x: 2000 }}
    class="sliding_page">
    {@render children()}
</div>

<style lang="scss">
    .sliding_page {
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        bottom: 0;
        @include z-index("right-panel");
        display: flex;
        padding-top: var(--status-bar-height);
    }
</style>
