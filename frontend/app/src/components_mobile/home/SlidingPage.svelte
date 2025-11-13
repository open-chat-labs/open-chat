<script lang="ts">
    import { swipe, type SwipeDirection } from "component-lib";
    import { publish } from "openchat-client";
    import type { Snippet } from "svelte";
    import { elasticInOut, expoInOut } from "svelte/easing";
    import { fade, fly } from "svelte/transition";

    interface Props {
        children: Snippet;
        top: boolean;
    }

    let { children, top }: Props = $props();

    function onSwipe(dir: SwipeDirection) {
        if (dir === "right") {
            console.trace("sliding page swipe");
            publish("closeModalPage");
        }
    }

    const SPEED = 500;
</script>

{#if !top}
    <div
        transition:fade={{ duration: SPEED, easing: elasticInOut }}
        class="sliding_page_overlay_before">
    </div>
{/if}
<div
    class:top
    use:swipe={{ onSwipe }}
    transition:fly={{ duration: SPEED, easing: expoInOut, x: window.innerWidth }}
    style={`--speed: ${SPEED}ms`}
    class="sliding_page">
    {@render children()}
</div>
{#if !top}
    <div transition:fade={{ duration: SPEED }} class="sliding_page_overlay"></div>
{/if}

<style lang="scss">
    .sliding_page {
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        bottom: 0;
        @include z-index("sliding-page");
        display: flex;
        padding-top: var(--status-bar-height);
        transition:
            transform ease-in-out var(--speed),
            opacity ease-in-out var(--speed);
        overflow: hidden;

        &:not(.top) {
            transform: scale(0.93);
            opacity: 0;
        }
    }

    .sliding_page_overlay_before,
    .sliding_page_overlay {
        width: 100%;
        height: 100%;
        position: absolute;
        overflow: hidden;
        top: 0;
        bottom: 0;
        @include z-index("sliding-page");
        display: flex;
        padding-top: var(--status-bar-height);
        margin-top: var(--status-bar-height);
        background-color: var(--background-0);
        opacity: 0.5;
    }

    .sliding_page_overlay_before {
        z-index: 4;
        background-color: var(--background-1);
    }
</style>
