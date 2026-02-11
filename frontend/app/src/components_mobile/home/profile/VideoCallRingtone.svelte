<script lang="ts">
    import { BodySmall, ColourVars, Column, IconButton, Radio, Row } from "component-lib";
    import { onMount } from "svelte";
    import PauseCircleOutline from "svelte-material-icons/PauseCircleOutline.svelte";
    import PlayCircleOutline from "svelte-material-icons/PlayCircleOutline.svelte";
    import WaveSurfer from "wavesurfer.js";
    import { Ringtone, selectedRingtone } from "../../../stores/video";
    import { currentTheme } from "../../../theme/themes";

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
            progressColor: $currentTheme.primary,
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

<Column>
    <Row crossAxisAlignment={"center"} mainAxisAlignment={"spaceBetween"}>
        <Radio
            value={$selectedRingtone}
            onChange={selectRingtone}
            {checked}
            id={ringtone.name}
            group="video-ringtone">
            <BodySmall>{ringtone.name}</BodySmall>
        </Radio>
        <IconButton size={"sm"} onclick={togglePlay}>
            {#snippet icon()}
                {#if ringtone.playing}
                    <PauseCircleOutline color={ColourVars.primary} />
                {:else}
                    <PlayCircleOutline color={ColourVars.textPrimary} />
                {/if}
            {/snippet}
        </IconButton>
    </Row>
    <div bind:this={waveform} class="waveform"></div>
</Column>

<style lang="scss">
    .waveform {
        width: 100%;
    }
</style>
