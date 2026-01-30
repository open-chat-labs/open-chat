<script module lang="ts">
    let current: WaveSurfer | undefined = undefined;
    let registry: WaveSurfer[] = [];
    function register(w: WaveSurfer) {
        registry.push(w);
    }

    function playNext(w: WaveSurfer) {
        for (let i = registry.length - 1; i > 0; i--) {
            if (registry[i] === w) {
                registry[i - 1]?.play();
            }
        }
    }
</script>

<script lang="ts">
    import { Body, Caption, ColourVars, Column, Container, IconButton, Row } from "component-lib";
    import type { AudioContent } from "openchat-client";
    import { onMount } from "svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Pause from "svelte-material-icons/PauseCircleOutline.svelte";
    import Play from "svelte-material-icons/PlayCircleOutline.svelte";
    import WaveSurfer from "wavesurfer.js";
    import ContentCaption from "./ContentCaption.svelte";

    interface Props {
        content: AudioContent;
        edited: boolean;
        blockLevelMarkdown?: boolean;
        onRemove?: () => void;
        draft?: boolean;
        me: boolean;
    }

    let {
        content,
        edited,
        blockLevelMarkdown = false,
        onRemove,
        draft = false,
        me,
    }: Props = $props();

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
                width: "100%",
                container: waveformDiv,
                waveColor: me ? "#feb3bf" : "#ffffff",
                progressColor: me ? "#ffffff" : "#23A2EE",
                cursorColor: me ? "#ffffff" : "#23A2EE",
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
                if (wavesurfer) {
                    playNext(wavesurfer);
                }
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

            register(wavesurfer);
        }
    });
</script>

<Row minWidth={"300px"} width={"fill"} padding={"sm"} crossAxisAlignment={"center"} gap={"sm"}>
    <Column
        mainAxisAlignment={"center"}
        crossAxisAlignment={"center"}
        width={{ size: "3.5rem" }}
        gap={"zero"}>
        <IconButton padding={["xs", "sm"]} size={"lg"} onclick={togglePlay} mode={"transparent"}>
            {#snippet icon()}
                {@const color = me ? ColourVars.textPrimary : ColourVars.textSecondary}
                {#if playing}
                    <Pause {color} />
                {:else}
                    <Play {color} />
                {/if}
            {/snippet}
        </IconButton>
        <Container mainAxisAlignment={"center"} crossAxisAlignment={"end"} gap={"xxs"}>
            <Caption fontWeight={"bold"} colour={me ? "textPrimary" : "secondary"} width={"hug"}>
                {currentTime ?? "0:00"}
            </Caption>
            <Caption width={"hug"}>/</Caption>
            <Caption colour={me ? "primaryLight" : "textSecondary"} width={"hug"}>
                {formatTime(duration)}
            </Caption>
        </Container>
    </Column>
    <div bind:this={waveformDiv} class="waveform"></div>
    <Row
        backgroundColor={me ? ColourVars.primaryLight : ColourVars.textTertiary}
        borderRadius={"xl"}
        mainAxisAlignment={"center"}
        onClick={cycleSpeed}
        gap={"xs"}
        width={{ size: "3rem" }}
        padding={["xs", "md"]}
        crossAxisAlignment={"center"}>
        <Body width={"hug"} fontWeight={"bold"} colour={me ? "myChatBubble" : "textPrimary"}>
            x{speed}
        </Body>
    </Row>

    {#if draft}
        <div class="close">
            <IconButton mode={"dark"} onclick={onRemove}>
                {#snippet icon()}
                    <Close color={ColourVars.textPrimary} />
                {/snippet}
            </IconButton>
        </div>
    {/if}
</Row>

<ContentCaption caption={content.caption} {edited} {blockLevelMarkdown} />

<style lang="scss">
    .waveform {
        width: 100%;
    }
</style>
