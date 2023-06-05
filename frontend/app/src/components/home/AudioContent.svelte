<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { AudioContent } from "openchat-client";
    import ContentCaption from "./ContentCaption.svelte";
    import MusicNote from "svelte-material-icons/MusicNote.svelte";
    import Pause from "svelte-material-icons/Pause.svelte";
    import { onMount } from "svelte";

    export let content: AudioContent;
    export let edited: boolean;

    let audioPlayer: HTMLAudioElement;
    let playing: boolean = false;
    let percPlayed: number = 0;
    const circum = 471.24;

    function timeupdate() {
        const fractionPlayed = Math.min(audioPlayer.currentTime / audioPlayer.duration, 1);
        percPlayed = fractionPlayed * 100;
    }

    function togglePlay() {
        if (playing) {
            audioPlayer.pause();
        } else {
            audioPlayer.play();
        }
    }
</script>

<audio
    on:timeupdate={timeupdate}
    preload="metadata"
    on:ended={() => (playing = false)}
    on:play={() => (playing = true)}
    on:pause={() => (playing = false)}
    bind:this={audioPlayer}>
    <track kind="captions" />
    {#if content.blobUrl}
        <source src={content.blobUrl} />
    {/if}
</audio>

<div class="circular" role="button" on:click={togglePlay}>
    <div class="circle">
        <div class="number">
            {#if playing}
                <Pause size={"2.5em"} color={"#fff"} />
            {:else}
                <MusicNote size={"2.5em"} color={"#fff"} />
            {/if}
        </div>
        <svg class="pie" viewBox="0 0 320 320">
            <clipPath id="hollow">
                <path
                    d="M 160 160 m -160 0 a 160 160 0 1 0 320 0 a 160 160 0 1 0 -320 0 Z M 160 160 m -100 0 a 100 100 0 0 1 200 0 a 100 100 0 0 1 -200 0 Z"
                    style="fill: rgb(216, 216, 216); stroke: rgb(0, 0, 0);" />
            </clipPath>

            <circle class="background" cx={160} cy={160} r={150} clip-path="url(#hollow)" />

            {#if percPlayed > 0}
                <circle
                    class={`slice`}
                    cx={160}
                    cy={160}
                    r={75}
                    stroke={"var(--accent)"}
                    clip-path="url(#hollow)"
                    transform={`rotate(${-90})`}
                    stroke-dasharray={`${(percPlayed * circum) / 100} ${circum}`} />
            {/if}
        </svg>
    </div>
</div>

<ContentCaption caption={content.caption} {edited} />

<style lang="scss">
    $size: 120px;

    .circle {
        position: relative;
        height: $size;
        width: $size;
        margin: auto;
        position: relative;
        background: transparent;

        .number {
            position: absolute;
            top: calc(50% - 1.25em);
            left: calc(50% - 1.25em);
        }

        .background {
            fill: var(--primary);
        }
    }

    .slice {
        fill: transparent;
        transform-origin: 50% 50%;
        stroke-width: 150px;
        cursor: pointer;
        transition: stroke-dasharray 100ms ease-in-out;
    }

    .pie {
        width: min(250px, 100%);
        margin-bottom: $sp5;
    }
</style>
