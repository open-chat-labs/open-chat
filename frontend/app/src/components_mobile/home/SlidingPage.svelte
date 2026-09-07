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

    // Once a page has been covered by another and its slide transition has
    // finished, stop painting it. It stays mounted (form state, scroll
    // position, back-navigation all rely on that) but costs nothing to render.
    // Visibility is restored synchronously when it becomes top again, before
    // the reverse transition starts.
    let settled = $state(false);
    $effect(() => {
        if (top) {
            settled = false;
            return;
        }
        const timer = setTimeout(() => (settled = true), speed);
        return () => clearTimeout(timer);
    });
</script>

{#if !top}
    <div
        transition:fade={{ duration: speed, easing: cubicInOut }}
        class="sliding_page_overlay_before">
    </div>
{/if}
<div
    class:top
    class:settled
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

        &.settled {
            visibility: hidden;
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
        background-color: var(--surface-0);
        opacity: 0.5;
    }

    .sliding_page_overlay_before {
        z-index: 4;
        background-color: var(--surface-1);
    }
</style>
