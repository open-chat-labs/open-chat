<script lang="ts">
    import { Caption, ColourVars, Container, IconButton } from "component-lib";
    import type { AudioContent } from "openchat-client";
    import { onMount } from "svelte";
    import Pause from "svelte-material-icons/PauseCircleOutline.svelte";
    import Play from "svelte-material-icons/PlayCircleOutline.svelte";
    import WaveSurfer from "wavesurfer.js";
    import ContentCaption from "./ContentCaption.svelte";

    interface Props {
        content: AudioContent;
        edited: boolean;
        blockLevelMarkdown?: boolean;
    }

    let { content, edited, blockLevelMarkdown = false }: Props = $props();

    let currentTime = $state<string>();
    let waveformDiv: HTMLDivElement | undefined;
    let playing = $state(false);
    let duration = $derived(Number(content.durationMs) / 1000);

    function togglePlay() {
        wavesurfer?.playPause();
        playing = wavesurfer?.isPlaying() ?? false;
    }

    const precomputed = $derived(Array.from(content.samples, (s: number) => s / 255));

    let wavesurfer = $state<WaveSurfer>();

    function formatTime(seconds: number) {
        const minutes = Math.floor(seconds / 60);
        const secondsRemainder = Math.round(seconds) % 60;
        const paddedSeconds = `0${secondsRemainder}`.slice(-2);
        return `${minutes}:${paddedSeconds}`;
    }

    const width = 3;

    onMount(() => {
        if (waveformDiv !== undefined) {
            wavesurfer = WaveSurfer.create({
                height: 50,
                barHeight: 0.9,
                width: 250,
                container: waveformDiv,
                waveColor: "#ffffff",
                progressColor: "#23A2EE",
                cursorColor: "#23A2EE",
                cursorWidth: width,
                barWidth: width,
                barRadius: 3,
                dragToSeek: true,
                barGap: width,
                url: content.blobUrl,
                peaks: precomputed.length > 0 ? [precomputed] : undefined,
                duration,
            });

            wavesurfer.on("interaction", () => {
                wavesurfer?.play();
            });

            wavesurfer.on("finish", () => {
                wavesurfer?.setTime(0);
            });

            wavesurfer.on("timeupdate", (t) => (currentTime = formatTime(t)));

            wavesurfer.on("play", () => (playing = true));

            wavesurfer.on("pause", () => (playing = false));
        }
    });
</script>

<Container crossAxisAlignment={"center"} gap={"md"}>
    <Container
        mainAxisAlignment={"center"}
        crossAxisAlignment={"center"}
        width={{ size: "3.5rem" }}
        direction={"vertical"}
        gap={"zero"}>
        <IconButton size={"lg"} onclick={togglePlay} mode={"transparent"}>
            {#snippet icon()}
                {@const color = ColourVars.textPrimary}
                {#if playing}
                    <Pause {color} />
                {:else}
                    <Play {color} />
                {/if}
            {/snippet}
        </IconButton>
        <Container mainAxisAlignment={"center"} crossAxisAlignment={"end"} gap={"xxs"}>
            <Caption fontWeight={"bold"} colour={"secondary"} width={"hug"}>
                {currentTime ?? "0:00"}
            </Caption>
            <Caption width={"hug"}>/</Caption>
            <Caption width={"hug"}>
                {formatTime(duration)}
            </Caption>
        </Container>
    </Container>

    <div bind:this={waveformDiv} class="waveform"></div>
</Container>

<ContentCaption caption={content.caption} {edited} {blockLevelMarkdown} />

<style lang="scss">
    .waveform {
        width: 100%;
    }
</style>
