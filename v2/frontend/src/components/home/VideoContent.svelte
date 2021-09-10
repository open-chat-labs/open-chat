<svelte:options immutable={true} />

<script lang="ts">
    import { onDestroy } from "svelte";
    import { _ } from "svelte-i18n";
    import type { MediaContent } from "../../domain/chat/chat";
    import PlayCircleOutline from "svelte-material-icons/PlayCircleOutline.svelte";
    import { dataToBlobUrl } from "../../utils/blob";
    import { DataClient } from "../../services/data/data.client";
    import type { Identity } from "@dfinity/agent";

    export let content: MediaContent;
    export let identity: Identity;

    let landscape = content.height < content.width;
    let downloaded: boolean = false;
    let videoPlayer: HTMLVideoElement;

    $: blobUrl =
        content.blobData &&
        content.blobData.then((data) => (data ? dataToBlobUrl(data, content.mimeType) : undefined));

    function download() {
        if (downloaded) return;

        if (content.blobReference) {
            // we need to overwrite the whole content object so that we trigger a re-render
            content = {
                ...content,
                blobData: DataClient.create(identity, content.blobReference.canisterId)
                    .getData(content.blobReference)
                    .then((data) => {
                        downloaded = true;
                        videoPlayer.play();
                        return data;
                    }),
            };
        }
    }

    onDestroy(() => {
        blobUrl && blobUrl.then((url) => (url ? URL.revokeObjectURL(url) : undefined));
    });
</script>

<div class="video" on:click={download}>
    <video bind:this={videoPlayer} poster={content.thumbnailData} class:landscape controls>
        <track kind="captions" />
        {#await blobUrl then url}
            {#if url}
                <source src={url} />
            {/if}
        {/await}
    </video>
    {#await blobUrl}
        <span class="icon loading" />
    {:then url}
        {#if !url}
            <span class="icon">
                <PlayCircleOutline size={"4em"} color={"#fff"} />
            </span>
        {/if}
    {/await}
</div>

<style type="text/scss">
    .video {
        position: relative;
        cursor: pointer;

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
    }
    .icon {
        position: absolute !important;
        width: 100%;
        height: 100%;
        top: calc(50% - 2em);
        left: calc(50% - 2em);

        &.loading {
            @include loading-spinner(3em, 1.5em, false, #fff);
            top: 0;
            left: 0;
        }
    }
</style>
