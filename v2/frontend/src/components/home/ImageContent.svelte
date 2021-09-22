<svelte:options immutable={true} />

<script lang="ts">
    import { onDestroy } from "svelte";
    import type { ImageContent } from "../../domain/chat/chat";

    export let content: ImageContent;

    let landscape = content.height < content.width;

    let style = landscape ? `width: ${content.width}px` : `height: ${content.height}px`;

    onDestroy(() => {
        content.blobUrl && URL.revokeObjectURL(content.blobUrl);
    });
</script>

{#if content.blobUrl !== undefined}
    <!-- This looks a bit odd, but it should display the thumbnail if the main image fails to load -->
    <object class:landscape title={content.caption} data={content.blobUrl} type={content.mimeType}>
        <img class:landscape {style} src={content.thumbnailData} alt={content.caption} />
    </object>
{/if}

{#if content.caption !== undefined}
    <p>{content.caption}</p>
{/if}

<style type="text/scss">
    img,
    object {
        max-width: none;
        width: auto;
        height: 100%;
        max-height: calc(var(--vh, 1vh) * 50);
        display: block;

        &.landscape {
            max-width: calc(var(--vh, 1vh) * 50);
            width: 100%;
            height: auto;
            max-height: none;
        }
    }
</style>
