<svelte:options immutable={true} />

<script lang="ts">
    import { onDestroy } from "svelte";
    import type { MediaContent } from "../../domain/chat/chat";
    import { dataToBlobUrl } from "../../utils/blob";

    export let content: MediaContent;

    let landscape = content.height < content.width;

    let style = landscape ? `width: ${content.width}px` : `height: ${content.height}px`;

    $: blobUrl =
        content.blobData &&
        content.blobData.then((data) => (data ? dataToBlobUrl(data, content.mimeType) : undefined));

    onDestroy(() => {
        blobUrl && blobUrl.then((url) => (url ? URL.revokeObjectURL(url) : undefined));
    });
</script>

{#if content.url !== undefined}
    <!-- This looks a bit odd, but it should display the thumbnail if the main image fails to load -->
    <object title={content.caption} data={content.url} type={content.mimeType}>
        <img class:landscape {style} src={content.thumbnailData} alt={content.caption} />
    </object>
{:else}
    {#await blobUrl}
        <img class:landscape {style} src={content.thumbnailData} alt={content.caption} />
    {:then url}
        <img class:landscape {style} src={url ?? content.thumbnailData} alt={content.caption} />
    {/await}
{/if}

<style type="text/scss">
    img {
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
