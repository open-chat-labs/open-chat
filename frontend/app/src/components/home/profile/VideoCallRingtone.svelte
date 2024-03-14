<script lang="ts">
    import PlayCircleOutline from "svelte-material-icons/PlayCircleOutline.svelte";
    import PauseCircleOutline from "svelte-material-icons/PauseCircleOutline.svelte";
    import Radio from "../../Radio.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { createEventDispatcher, onMount } from "svelte";
    import { Ringtone, selectedRingtone } from "../../../stores/video";
    import WaveSurfer from "wavesurfer.js";
    import { currentTheme } from "../../../theme/themes";

    const dispatch = createEventDispatcher();

    export let ringtone: Ringtone;

    let waveform: HTMLDivElement;

    $: checked = $selectedRingtone === ringtone.key;

    onMount(() => {
        const wavesurfer = WaveSurfer.create({
            height: 30,
            cursorWidth: 0,
            barWidth: 2,
            barRadius: 4,
            barGap: 2,
            container: waveform,
            waveColor: $currentTheme["txt-light"],
            progressColor: $currentTheme.accent,
            media: ringtone.audio,
        });

        wavesurfer.on("click", () => {
            if (!ringtone.playing) {
                togglePlay();
            }
        });
    });

    function togglePlay() {
        dispatch("togglePlay", ringtone);
    }

    function selectRingtone() {
        selectedRingtone.set(ringtone.key);
    }
</script>

<div class="wrapper">
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
    <div bind:this={waveform} class="waveform"></div>
</div>

<style lang="scss">
    .wrapper {
        border: var(--bw) solid var(--bd);
        border-radius: var(--rd);
        padding: $sp3;
        margin-bottom: $sp3;
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
