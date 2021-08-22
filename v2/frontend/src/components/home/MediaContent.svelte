<svelte:options immutable={true} />

<script lang="ts">
    import { afterUpdate, onDestroy } from "svelte";
    import { _ } from "svelte-i18n";
    import type { MediaContent } from "../../domain/chat/chat";
    import PlayCircleOutline from "svelte-material-icons/PlayCircleOutline.svelte";
    import { dataToBlobUrl } from "../../utils/blob";
    import { DataClient } from "../../services/data/data.client";

    export let content: MediaContent;
    let landscape = content.height < content.width;
    let isImage = /^image/.test(content.mimeType);
    let isVideo = /^video/.test(content.mimeType);
    let isAudio = /^audio/.test(content.mimeType);
    let downloaded: boolean = false;
    let videoPlayer: HTMLVideoElement;
    $: blobUrl = content.blobData.then((data) =>
        data ? dataToBlobUrl(data, content.mimeType) : undefined
    );

    function download() {
        if (!isVideo) return;

        if (content.blobReference) {
            // we need to overwrite the whole content object so that we trigger a re-render
            const blobData = DataClient.create(content.blobReference.canisterId)
                .getData(content.blobReference)
                .then((data) => {
                    downloaded = true;
                    content = {
                        ...content,
                        blobData,
                    };
                    return data;
                });
        }
    }

    afterUpdate(() => {
        if (downloaded && videoPlayer) {
            videoPlayer.play();
        }
    });

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
            <video bind:this={videoPlayer} class:landscape controls>
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
    {:else}
        <div class="thumbnail" class:video={isVideo} on:click={download}>
            <img class:landscape src={content.thumbnailData} alt={content.caption} />
            {#if isVideo}
                <span class="icon">
                    <PlayCircleOutline size={"4em"} color={"#fff"} />
                </span>
            {/if}
        </div>
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
    audio {
        max-width: 230px;
    }
    .thumbnail.video {
        cursor: pointer;
        position: relative;

        .icon {
            position: absolute;
            top: calc(50% - 2em);
            left: calc(50% - 2em);
        }
    }
</style>
