<script lang="ts">
    import { BodySmall, ColourVars, Column, IconButton, Radio, Row } from "component-lib";
    import { onMount } from "svelte";
    import PauseCircleOutline from "svelte-material-icons/PauseCircleOutline.svelte";
    import PlayCircleOutline from "svelte-material-icons/PlayCircleOutline.svelte";
    import { Ringtone, selectedRingtone } from "../../../stores/video";
    import { currentTheme } from "../../../theme/themes";
    import { loadWaveSurfer, waveSurferFailedToLoad } from "../../../utils/wavesurfer";

    interface Props {
        ringtone: Ringtone;
        onTogglePlay: (ringtone: Ringtone) => void;
    }

    let { ringtone, onTogglePlay }: Props = $props();

    // reserved from the start, as the waveform only arrives once wavesurfer has loaded
    const WAVEFORM_HEIGHT = 30;

    let waveform: HTMLDivElement | undefined = $state();

    let checked = $derived($selectedRingtone === ringtone.key);

    onMount(() => {
        if (!waveform) return;

        let unmounted = false;

        loadWaveSurfer().then((WaveSurfer) => {
            if (unmounted || !waveform) return;

            const wavesurfer = WaveSurfer.create({
                height: WAVEFORM_HEIGHT,
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
        }, waveSurferFailedToLoad);

        return () => {
            unmounted = true;
        };
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
    <div bind:this={waveform} class="waveform" style:min-height="{WAVEFORM_HEIGHT}px"></div>
</Column>

<style lang="scss">
    .waveform {
        width: 100%;
    }
</style>
