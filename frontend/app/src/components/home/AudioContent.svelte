<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { AudioContent } from "openchat-client";
    import ContentCaption from "./ContentCaption.svelte";
    import MusicNote from "svelte-material-icons/MusicNote.svelte";
    import Pause from "svelte-material-icons/Pause.svelte";

    export let content: AudioContent;
    export let edited: boolean;

    let audioPlayer: HTMLAudioElement;
    let playing: boolean = false;
    let fractionPlayed: number = 0;
    let leftRotation: number = 0;
    let rightRotation: number = 0;

    function timeupdate() {
        fractionPlayed = Math.min(audioPlayer.currentTime / audioPlayer.duration, 1);
        leftRotation = Math.min(180, fractionPlayed * 360);
        rightRotation = Math.max(0, fractionPlayed * 360 - 180);
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
    preload="none"
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
    <div class="inner" />
    <div class="number">
        {#if playing}
            <Pause size={"2.5em"} color={"#fff"} />
        {:else}
            <MusicNote size={"2.5em"} color={"#fff"} />
        {/if}
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

<ContentCaption caption={content.caption} {edited} />

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
