<svelte:options immutable={true} />

<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import type { ImageContent } from "../../domain/chat/chat";
    import { calculateHeight } from "../../utils/layout";
    import Caption from "./Caption.svelte";

    export let content: ImageContent;

    let obj: HTMLElement;
    let landscape = content.height < content.width;
    let height = 0;

    function recalculateHeight() {
        height = calculateHeight(
            document.getElementById("chat-messages")?.offsetWidth ?? 0,
            content
        );
    }

    onMount(recalculateHeight);

    onDestroy(() => {
        content.blobUrl && URL.revokeObjectURL(content.blobUrl);
    });
</script>

<svelte:window on:resize={recalculateHeight} />

{#if content.blobUrl !== undefined}
    <!-- This looks a bit odd, but it should display the thumbnail if the main image fails to load -->
    <object
        bind:this={obj}
        class:landscape
        style={`height: ${height}px`}
        title={content.caption}
        data={content.blobUrl}
        type={content.mimeType}>
        <img
            class:landscape
            style={`height: ${height}px`}
            src={content.thumbnailData}
            alt={content.caption} />
    </object>
{/if}

{#if content.caption !== undefined}
    <Caption caption={content.caption} />
{/if}

<style type="text/scss">
    img,
    object {
        max-width: none;
        width: auto;
        display: block;

        &.landscape {
            max-width: calc(var(--vh, 1vh) * 50);
            width: 100%;
        }
    }
</style>
