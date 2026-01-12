<script lang="ts">
    import type { Snippet } from "svelte";
    import { cubicInOut } from "svelte/easing";
    import { fade, fly } from "svelte/transition";

    interface Props {
        children: Snippet;
        top: boolean;
        speed?: number;
    }

    let { children, top, speed = 300 }: Props = $props();
</script>

{#if !top}
    <div
        transition:fade={{ duration: speed, easing: cubicInOut }}
        class="sliding_page_overlay_before">
    </div>
{/if}
<div
    class:top
    transition:fly={{ duration: speed, easing: cubicInOut, x: window.innerWidth }}
    style={`--speed: ${speed}ms`}
    class="sliding_page">
    {@render children()}
</div>
{#if !top}
    <div transition:fade={{ duration: speed }} class="sliding_page_overlay"></div>
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

        // Changing the opacity here will expose any content under the sliding
        // page, in cases where another sliding page is stacked on top!
        // E.g. profile -> app settings -> about OpenChat
        // TODO fix the above!
        &:not(.top) {
            transform: scale(0.93);
            opacity: 0.8;
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
