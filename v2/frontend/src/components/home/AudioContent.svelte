<svelte:options immutable={true} />

<script lang="ts">
    import { afterUpdate, onDestroy, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import type { MediaContent } from "../../domain/chat/chat";
    import MusicNote from "svelte-material-icons/MusicNote.svelte";
    import CloudDownloadOutline from "svelte-material-icons/CloudDownloadOutline.svelte";
    import Pause from "svelte-material-icons/Pause.svelte";
    import { dataToBlobUrl } from "../../utils/blob";
    import { DataClient } from "../../services/data/data.client";

    export let content: MediaContent;

    let landscape = content.height < content.width;
    let downloaded: boolean = false;
    let audioPlayer: HTMLAudioElement;
    let playing: boolean = false;

    $: blobUrl = content.blobData.then((data) => {
        if (data) {
            downloaded = true;
            return dataToBlobUrl(data, content.mimeType);
        }
        return undefined;
    });

    function download() {
        if (downloaded) {
            if (playing) {
                audioPlayer.pause();
            } else {
                audioPlayer.play();
            }
            return;
        }

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

    onDestroy(() => {
        blobUrl.then((url) => (url ? URL.revokeObjectURL(url) : undefined));
    });
</script>

<div class="audio" on:click={download}>
    <audio
        on:ended={() => (playing = false)}
        on:play={() => (playing = true)}
        on:pause={() => (playing = false)}
        bind:this={audioPlayer}
        class:landscape>
        <track kind="captions" />
        {#await blobUrl then url}
            {#if url}
                <source src={url} />
            {/if}
        {/await}
    </audio>
    {#await blobUrl}
        <CloudDownloadOutline size={"3em"} color={"#fff"} />
    {:then _url}
        {#if playing}
            <Pause size={"3em"} color={"#fff"} />
        {:else}
            <MusicNote size={"3em"} color={"#fff"} />
        {/if}
    {/await}
</div>

<style type="text/scss">
    $size: 80px;

    .audio {
        position: relative;
        cursor: pointer;
        width: $size;
        height: $size;
        display: flex;
        justify-content: center;
        align-items: center;
        border-radius: $sp4;
        border-radius: 50%;
        background: linear-gradient(#ef5da8, #22a7f2);
    }
    audio {
        max-width: 230px;
    }
</style>
