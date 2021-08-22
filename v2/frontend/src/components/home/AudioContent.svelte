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
    let downloaded: boolean = false;
    let audioPlayer: HTMLAudioElement;

    $: blobUrl = content.blobData.then((data) =>
        data ? dataToBlobUrl(data, content.mimeType) : undefined
    );

    function download() {
        if (downloaded) return;

        if (content.blobReference) {
            // we need to overwrite the whole content object so that we trigger a re-render
            content = {
                ...content,
                blobData: DataClient.create(content.blobReference.canisterId).getData(
                    content.blobReference
                ),
            };
            content.blobData.then(() => {
                downloaded = true;
                audioPlayer.play();
            });
        }
    }

    afterUpdate(() => {
        if (downloaded && audioPlayer) {
            audioPlayer.play();
        }
    });

    onDestroy(() => {
        blobUrl.then((url) => (url ? URL.revokeObjectURL(url) : undefined));
    });
</script>

<div class="thumbnail" on:click={download}>
    <audio bind:this={audioPlayer} poster={content.thumbnailData} class:landscape controls>
        <track kind="captions" />
        {#await blobUrl then url}
            {#if url}
                <source src={url} />
            {/if}
        {/await}
    </audio>
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
    audio {
        max-width: 230px;
    }
</style>
