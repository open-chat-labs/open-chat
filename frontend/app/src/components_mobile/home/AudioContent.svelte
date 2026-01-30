<script module lang="ts">
    let current: WaveSurfer | undefined = undefined;
</script>

<script lang="ts">
    import {
        BodySmall,
        Caption,
        ColourVars,
        Column,
        Container,
        IconButton,
        Row,
    } from "component-lib";
    import type { AudioContent } from "openchat-client";
    import { onMount } from "svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Pause from "svelte-material-icons/PauseCircleOutline.svelte";
    import Play from "svelte-material-icons/PlayCircleOutline.svelte";
    import PlaySpeed from "svelte-material-icons/PlaySpeed.svelte";
    import WaveSurfer from "wavesurfer.js";
    import ContentCaption from "./ContentCaption.svelte";

    interface Props {
        content: AudioContent;
        edited: boolean;
        blockLevelMarkdown?: boolean;
        onRemove?: () => void;
        draft?: boolean;
    }

    let { content, edited, blockLevelMarkdown = false, onRemove, draft = false }: Props = $props();

    let currentTime = $state<string>();
    let waveformDiv: HTMLDivElement | undefined;
    let playing = $state(false);
    let duration = $derived(Number(content.durationMs) / 1000);
    let speed = $state(1);

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

    $effect(() => {
        wavesurfer?.setPlaybackRate(speed, true);
    });

    function cycleSpeed() {
        switch (speed) {
            case 1:
                speed = 1.5;
                break;
            case 1.5:
                speed = 2;
                break;
            case 2:
                speed = 1;
                break;
            default:
                speed = 1;
                break;
        }
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

            wavesurfer.on("play", () => {
                if (wavesurfer !== current) {
                    current?.pause();
                    current = wavesurfer;
                }
                playing = true;
            });

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

    <Column padding={"sm"} crossAxisAlignment={"end"} gap={"xs"}>
        <div bind:this={waveformDiv} class="waveform"></div>
        <Row
            mainAxisAlignment={"end"}
            onClick={cycleSpeed}
            gap={"xs"}
            width={"hug"}
            crossAxisAlignment={"center"}>
            <PlaySpeed color={ColourVars.textPrimary} />
            <BodySmall fontWeight={"bold"}>{speed}</BodySmall>
        </Row>
    </Column>

    {#if draft}
        <div class="close">
            <IconButton mode={"dark"} onclick={onRemove}>
                {#snippet icon()}
                    <Close color={ColourVars.textPrimary} />
                {/snippet}
            </IconButton>
        </div>
    {/if}
</Container>

<ContentCaption caption={content.caption} {edited} {blockLevelMarkdown} />

<style lang="scss">
    .waveform {
        width: 100%;
    }
</style>
