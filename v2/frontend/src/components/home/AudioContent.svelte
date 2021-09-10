<svelte:options immutable={true} />

<script lang="ts">
    import { onDestroy } from "svelte";
    import { _ } from "svelte-i18n";
    import type { MediaContent } from "../../domain/chat/chat";
    import MusicNote from "svelte-material-icons/MusicNote.svelte";
    import CloudDownloadOutline from "svelte-material-icons/CloudDownloadOutline.svelte";
    import Pause from "svelte-material-icons/Pause.svelte";
    import { dataToBlobUrl } from "../../utils/blob";
    import { DataClient } from "../../services/data/data.client";
    import type { Identity } from "@dfinity/agent";

    export let content: MediaContent;
    export let identity: Identity;

    let downloaded: boolean = false;
    let audioPlayer: HTMLAudioElement;
    let playing: boolean = false;
    let fractionPlayed: number = 0;
    let leftRotation: number = 0;
    let rightRotation: number = 0;

    $: blobUrl =
        content.blobData &&
        content.blobData.then((data) => {
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
                blobData: DataClient.create(identity, content.blobReference.canisterId)
                    .getData(content.blobReference)
                    .then((data) => {
                        downloaded = true;
                        audioPlayer.play();
                        return data;
                    }),
            };
        }
    }

    onDestroy(() => {
        blobUrl && blobUrl.then((url) => (url ? URL.revokeObjectURL(url) : undefined));
    });

    function timeupdate() {
        fractionPlayed = Math.min(audioPlayer.currentTime / audioPlayer.duration, 1);
        leftRotation = Math.min(180, fractionPlayed * 360);
        rightRotation = Math.max(0, fractionPlayed * 360 - 180);
    }
</script>

<audio
    on:timeupdate={timeupdate}
    on:ended={() => (playing = false)}
    on:play={() => (playing = true)}
    on:pause={() => (playing = false)}
    bind:this={audioPlayer}>
    <track kind="captions" />
    {#await blobUrl then url}
        {#if url}
            <source src={url} />
        {/if}
    {/await}
</audio>

<div class="circular" role="button" on:click={download}>
    <div class="inner" />
    <div class="number">
        {#await blobUrl}
            <CloudDownloadOutline size={"2.5em"} color={"#fff"} />
        {:then _url}
            {#if playing}
                <Pause size={"2.5em"} color={"#fff"} />
            {:else}
                <MusicNote size={"2.5em"} color={"#fff"} />
            {/if}
        {/await}
    </div>
    <div class="circle">
        <div class="bar left">
            <div class="progress" style={`transform: rotate(${leftRotation}deg)`} />
        </div>
        <div class="bar right">
            <div class="progress" style={`transform: rotate(${rightRotation}deg)`} />
        </div>
    </div>
</div>

<style type="text/scss">
    $size: 80px;
    $half-size: calc(#{$size} / 2);
    $inner: calc(#{$size} - 10px);
    $margin: -35px;

    .circular {
        height: $size;
        width: $size;
        position: relative;
        background: transparent;
        margin-bottom: $sp3;

        .inner,
        .number {
            position: absolute;
            top: 50%;
            left: 50%;
        }

        .inner {
            z-index: 6;
            height: $inner;
            width: $inner;
            margin: $margin 0 0 $margin;
            // background: linear-gradient(#ef5da8, #22a7f2);
            background: radial-gradient(#22a7f2, #ef5da8);
            // opacity: 0.8;
            border-radius: 100%;
        }

        .number {
            transform: translate(-50%, -50%);
            z-index: 10;
            color: var(--button-bg);
        }

        .bar {
            position: absolute;
            height: 100%;
            width: 100%;
            background: hotpink;
            border-radius: 100%;
            clip: rect(0px, $size, $size, $half-size);
        }
    }

    .circle {
        .bar {
            .progress {
                position: absolute;
                height: 100%;
                width: 100%;
                border-radius: 100%;
                clip: rect(0px, $half-size, $size, 0px);
                background-color: var(--button-bg);
                transition: transform 100ms ease-in-out;
            }
        }

        .left {
            .progress {
                z-index: 1;
            }
        }

        .right {
            transform: rotate(180deg);
            z-index: 3;
        }
    }
</style>
