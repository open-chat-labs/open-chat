<script lang="ts">
    import { ui } from "openchat-client";
    import { onMount } from "svelte";
    import PauseCircleOutline from "svelte-material-icons/PauseCircleOutline.svelte";
    import PlayCircleOutline from "svelte-material-icons/PlayCircleOutline.svelte";
    import WaveSurfer from "wavesurfer.js";
    import { Ringtone, selectedRingtone } from "../../../stores/video";
    import { currentTheme } from "../../../theme/themes";
    import Radio from "../../Radio.svelte";

    interface Props {
        ringtone: Ringtone;
        onTogglePlay: (ringtone: Ringtone) => void;
    }

    let { ringtone, onTogglePlay }: Props = $props();

    let waveform: HTMLDivElement | undefined = $state();

    let checked = $derived($selectedRingtone === ringtone.key);

    onMount(() => {
        if (!waveform) return;

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

    function togglePlay(e?: Event) {
        e?.preventDefault();
        onTogglePlay(ringtone);
    }

    function selectRingtone() {
        selectedRingtone.set(ringtone.key);
    }
</script>

<div class="wrapper">
    <Radio onChange={selectRingtone} {checked} id={ringtone.name} group="video-ringtone">
        <div class="ringtone">
            <div class="name">{ringtone.name}</div>
            <div onclick={togglePlay} class="play">
                {#if ringtone.playing}
                    <PauseCircleOutline size={ui.iconSize} color={"var(--icon-selected)"} />
                {:else}
                    <PlayCircleOutline size={ui.iconSize} color={"var(--icon-txt)"} />
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
