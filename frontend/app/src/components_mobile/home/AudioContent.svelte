<script lang="ts">
    import type { AudioContent } from "openchat-client";
    import ContentCaption from "./ContentCaption.svelte";
    import MusicNote from "svelte-material-icons/MusicNote.svelte";
    import Pause from "svelte-material-icons/Pause.svelte";
    import { setPlayingMedia } from "../../utils/media";

    interface Props {
        content: AudioContent;
        edited: boolean;
        blockLevelMarkdown?: boolean;
        me: boolean;
    }

    let { content, edited, blockLevelMarkdown = false, me }: Props = $props();

    let inner = $derived(`var(--audio${me ? "-me" : ""}-inner)`);
    let note = $derived(`var(--audio${me ? "-me" : ""}-note)`);

    let audioPlayer: HTMLAudioElement | undefined = $state();
    let playing: boolean = $state(false);
    let percPlayed: number = $state(0);
    const circum = 471.24;

    function timeupdate() {
        if (!audioPlayer) return;
        const fractionPlayed = Math.min(audioPlayer.currentTime / audioPlayer.duration, 1);
        percPlayed = fractionPlayed * 100;
    }

    function togglePlay() {
        if (playing) {
            audioPlayer?.pause();
        } else {
            audioPlayer?.play();
        }
    }

    function onPlay() {
        if (!audioPlayer) return;
        playing = true;
        setPlayingMedia(audioPlayer);
    }
</script>

<audio
    ontimeupdate={timeupdate}
    preload="metadata"
    onended={() => (playing = false)}
    onplay={onPlay}
    onpause={() => (playing = false)}
    bind:this={audioPlayer}>
    <track kind="captions" />
    {#if content.blobUrl}
        <source src={content.blobUrl} />
    {/if}
</audio>

<div class="circular" role="button" onclick={togglePlay}>
    <div class="circle">
        <div class="number">
            {#if playing}
                <Pause size={"2.5em"} color={note} />
            {:else}
                <MusicNote size={"2.5em"} color={note} />
            {/if}
        </div>
        <svg class="pie" viewBox="0 0 320 320">
            <clipPath id="hollow">
                <path
                    d="M 160 160 m -160 0 a 160 160 0 1 0 320 0 a 160 160 0 1 0 -320 0 Z M 160 160 m -100 0 a 100 100 0 0 1 200 0 a 100 100 0 0 1 -200 0 Z"
                    style={`fill: rgb(216, 216, 216); stroke: rgb(0, 0, 0);`} />
            </clipPath>

            <circle
                class:me
                class="background"
                cx={160}
                cy={160}
                r={150}
                clip-path="url(#hollow)" />

            {#if percPlayed > 0}
                <circle
                    class={`slice`}
                    cx={160}
                    cy={160}
                    r={75}
                    stroke={inner}
                    clip-path="url(#hollow)"
                    transform={`rotate(${-90})`}
                    stroke-dasharray={`${(percPlayed * circum) / 100} ${circum}`} />
            {/if}
        </svg>
    </div>
</div>

<ContentCaption caption={content.caption} {edited} {blockLevelMarkdown} />

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
            fill: var(--audio-outer);

            &.me {
                fill: var(--audio-me-outer);
            }
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
