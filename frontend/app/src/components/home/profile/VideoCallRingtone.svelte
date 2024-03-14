<script lang="ts">
    import PlayCircleOutline from "svelte-material-icons/PlayCircleOutline.svelte";
    import PauseCircleOutline from "svelte-material-icons/PauseCircleOutline.svelte";
    import Radio from "../../Radio.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { createEventDispatcher, onMount } from "svelte";
    import { Ringtone, selectedRingtone } from "../../../stores/video";

    const dispatch = createEventDispatcher();

    export let ringtone: Ringtone;

    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D | null;

    $: checked = $selectedRingtone === ringtone.key;

    onMount(() => {
        ctx = canvas.getContext("2d");
        setTimeout(() => {
            drawWaveform();
        }, 2000);
    });

    function togglePlay() {
        dispatch("togglePlay", ringtone);
    }

    function selectRingtone() {
        selectedRingtone.set(ringtone.key);
    }

    function drawWaveform() {
        if (!ctx) return;

        const audioContext = new AudioContext();
        const source = audioContext.createMediaElementSource(ringtone.audio);
        const analyser = audioContext.createAnalyser();
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        analyser.fftSize = 2048;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw waveform
        function draw() {
            if (!ctx) return;

            const sliceWidth = (canvas.width * 1.0) / bufferLength;
            let x = 0;
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#00f";

            analyser.getByteTimeDomainData(dataArray);

            ctx.beginPath();
            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = (v * canvas.height) / 2;
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
                x += sliceWidth;
            }
            ctx.lineTo(canvas.width, canvas.height / 2);
            ctx.stroke();
        }

        // Render the waveform
        function render() {
            draw();
            // requestAnimationFrame(render);
        }

        render();
    }
</script>

<Radio on:change={selectRingtone} {checked} id={ringtone.name} group="video-ringtone">
    <div class="ringtone">
        <div class="name">{ringtone.name}</div>
        <div on:click|preventDefault={togglePlay} class="play">
            {#if ringtone.playing}
                <PauseCircleOutline size={$iconSize} color={"var(--icon-selected)"} />
            {:else}
                <PlayCircleOutline size={$iconSize} color={"var(--icon-txt)"} />
            {/if}
        </div>
    </div>
</Radio>

<canvas bind:this={canvas} />

<style lang="scss">
    canvas {
        height: 50px;
    }

    .ringtone {
        display: flex;
        gap: $sp4;
        align-items: center;
        justify-content: space-between;
    }

    .play {
        cursor: pointer;
    }
</style>
