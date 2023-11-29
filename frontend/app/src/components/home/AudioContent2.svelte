<svelte:options immutable />

<script lang="ts">
    import type { AudioContent } from "openchat-client";
    import ContentCaption from "./ContentCaption.svelte";
    import { setPlayingMedia } from "../../utils/media";
    import { onMount } from "svelte";
    import { currentTheme } from "../../theme/themes";

    export let content: AudioContent;
    export let edited: boolean;

    let canvasContext: CanvasRenderingContext2D | null;
    let audioContext = new AudioContext();
    let audioPlayer: HTMLAudioElement;
    let waveformCanvas: HTMLCanvasElement;
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

    function onPlay() {
        playing = true;
        setPlayingMedia(audioPlayer);
    }

    let animationFrameId: number | undefined = undefined;

    function stopAnimation() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
    }

    function start() {
        audioPlayer.play();

        const animateWaveform = () => {
            drawPlayedWaveform();
            animationFrameId = requestAnimationFrame(animateWaveform);
        };

        animateWaveform();
    }

    function drawPlayedWaveform() {
        if (!canvasContext) return;

        const bufferLength = audioPlayer.duration * 100; // Assume 100 points per second
        const sliceWidth = (waveformCanvas.width * 1.0) / bufferLength;
        let x = 0;

        canvasContext.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
        canvasContext.beginPath();

        for (let i = 0; i < bufferLength; i++) {
            const audioTime = i / 100; // Convert point index to audio time
            const v = audioPlayer.currentTime >= audioTime ? 1 : 0;
            const y = v * waveformCanvas.height;

            if (i === 0) {
                canvasContext.moveTo(x, y);
            } else {
                canvasContext.lineTo(x, y);
            }

            x += sliceWidth;
        }

        canvasContext.lineWidth = 2;
        canvasContext.strokeStyle = "#0000FF"; // Change color for the played part
        canvasContext.stroke();

        animationFrameId = requestAnimationFrame(drawPlayedWaveform);
    }

    async function drawWaveform() {
        if (!content.blobUrl || !canvasContext) return;

        const response = await fetch(content.blobUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const bufferLength = audioBuffer.length;
        const dataArray = new Float32Array(bufferLength);

        audioBuffer.copyFromChannel(dataArray, 0);

        canvasContext.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
        canvasContext.beginPath();

        const sliceWidth = (waveformCanvas.width * 1.0) / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = (dataArray[i] + 1) / 2; // Normalize values to be between 0 and 1
            const y = v * waveformCanvas.height;

            if (i === 0) {
                canvasContext.moveTo(x, y);
            } else {
                canvasContext.lineTo(x, y);
            }

            x += sliceWidth;
        }

        canvasContext.lineWidth = 2;
        canvasContext.strokeStyle = $currentTheme.accent;
        canvasContext.stroke();
    }

    onMount(() => {
        canvasContext = waveformCanvas.getContext("2d");
        drawWaveform();
    });
</script>

<audio
    on:timeupdate={timeupdate}
    preload="metadata"
    on:ended={stopAnimation}
    on:play={start}
    on:pause={stopAnimation}
    bind:this={audioPlayer}>
    <track kind="captions" />
    {#if content.blobUrl}
        <source src={content.blobUrl} />
    {/if}
</audio>

<canvas bind:this={waveformCanvas} width="500" height="200"></canvas>

<button on:click={start}>Start</button>

<!-- <div class="circular" role="button" on:click={togglePlay}>
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
</div> -->

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
