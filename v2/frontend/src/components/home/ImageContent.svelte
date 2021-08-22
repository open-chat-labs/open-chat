<svelte:options immutable={true} />

<script lang="ts">
    import { onDestroy } from "svelte";
    import type { MediaContent } from "../../domain/chat/chat";
    import { dataToBlobUrl } from "../../utils/blob";

    export let content: MediaContent;

    let landscape = content.height < content.width;

    $: blobUrl = content.blobData.then((data) =>
        data ? dataToBlobUrl(data, content.mimeType) : undefined
    );

    onDestroy(() => {
        blobUrl.then((url) => (url ? URL.revokeObjectURL(url) : undefined));
    });
</script>

{#await blobUrl}
    <img class:landscape src={content.thumbnailData} alt={content.caption} />
{:then url}
    <img class:landscape src={url ?? content.thumbnailData} alt={content.caption} />
{/await}

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
