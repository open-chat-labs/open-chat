<svelte:options immutable={true} />

<script lang="ts">
    import { onDestroy } from "svelte";
    import { _ } from "svelte-i18n";
    import type { MediaContent } from "../../domain/chat/chat";
    import { dataToBlobUrl } from "../../utils/blob";

    export let content: MediaContent;
    let landscape = content.height < content.width;
    let isImage = /^image/.test(content.mimeType);
    let isVideo = /^video/.test(content.mimeType);
    let isAudio = /^audio/.test(content.mimeType);
    let blobUrl = content.blobData.then((data) =>
        data ? dataToBlobUrl(data, content.mimeType) : undefined
    );

    onDestroy(() => {
        blobUrl.then((url) => (url ? URL.revokeObjectURL(url) : undefined));
    });
</script>

{#await blobUrl}
    <img class:landscape src={content.thumbnailData} alt={content.caption} />
{:then url}
    {#if url}
        {#if isImage}
            <img class:landscape src={url} alt={content.caption} />
        {/if}
        {#if isVideo}
            <video class:landscape controls>
                <source src={url} />
                <track kind="captions" />
                {$_("noVideo")}
            </video>
        {/if}
        {#if isAudio}
            <audio controls>
                <source src={url} />
                <track kind="captions" />
                {$_("noAudio")}
            </audio>
        {/if}
    {/if}
{/await}
{#if content.caption !== undefined}
    <p>{content.caption}</p>
{/if}

<style type="text/scss">
    img,
    video {
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
