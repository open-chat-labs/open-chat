<svelte:options immutable={true} />

<script lang="ts">
    import { onMount } from "svelte";
    import type { ImageContent } from "../../domain/chat/chat";
    import { calculateHeight } from "../../utils/layout";
    import Caption from "./Caption.svelte";

    export let content: ImageContent;
    export let fill: boolean;
    let imgElement: HTMLImageElement;

    let landscape = content.height < content.width;
    let height = 0;

    function recalculateHeight() {
        height = calculateHeight(
            document.getElementById("chat-messages")?.offsetWidth ?? 0,
            content
        );
    }

    onMount(recalculateHeight);
</script>

<svelte:window on:resize={recalculateHeight} />

{#if content.blobUrl !== undefined}
    <img
        bind:this={imgElement}
        on:error={() => (imgElement.src = content.thumbnailData)}
        class:landscape
        class:fill
        style={`height: ${height}px`}
        src={content.blobUrl}
        alt={content.caption} />
{/if}

{#if content.caption !== undefined}
    <Caption caption={content.caption} />
{/if}

<style type="text/scss">
    img {
        max-width: none;
        width: auto;
        display: block;

        &:not(.fill) {
            border-radius: $sp4;
        }

        &.landscape {
            max-width: calc(var(--vh, 1vh) * 50);
        }
    }
</style>
