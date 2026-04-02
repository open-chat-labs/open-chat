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
    import {
        Body,
        BodySmall,
        ChatFootnote,
        ColourVars,
        Column,
        Container,
        IconButton,
        Row,
        type ColourVarKeys,
    } from "component-lib";
    import type { AudioContent, TextContent as TextContentType } from "openchat-client";
    import { onMount, type Snippet } from "svelte";
    import WaveSurfer from "wavesurfer.js";
    import { rtlStore } from "@stores/rtl";
    import TextContent from "./TextContent.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Pause from "svelte-material-icons/PauseCircleOutline.svelte";
    import Play from "svelte-material-icons/PlayCircleOutline.svelte";
    import MicrophoneOutline from "svelte-material-icons/MicrophoneOutline.svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "@src/i18n/i18n";

    interface Props {
        content: AudioContent;
        edited: boolean;
        blockLevelMarkdown?: boolean;
        onRemove?: () => void;
        draft?: boolean;
        me: boolean;
        reply?: boolean;
        title?: Snippet;
    }

    let {
        content,
        edited,
        blockLevelMarkdown = false,
        onRemove,
        draft = false,
        me,
        reply = false,
        title,
    }: Props = $props();

    // TODO this pattern seems to repeat itself for various components, we should find a better way to handle this.
    let textContent = $derived<TextContentType | undefined>(
        !!content.caption ? { kind: "text_content", text: content.caption ?? "" } : undefined,
    );
    let hasContent = $derived(!!textContent?.text);
    let textHighlightColour = $derived<ColourVarKeys>(me ? "secondaryLight" : "primaryLight");

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

    function getColor(varName: string): string {
        const root = document.documentElement;
        return getComputedStyle(root).getPropertyValue(varName).trim();
    }

    const textPrimaryColor = getColor("--text-primary");
    const primaryLightColor = getColor("--primary-light");
    const secondaryColor = getColor("--secondary");

    onMount(() => {
        if (waveformDiv !== undefined) {
            wavesurfer = WaveSurfer.create({
                height: 42,
                barHeight: 0.65,
                width: "100%",
                container: waveformDiv,
                waveColor: draft || !me ? textPrimaryColor : primaryLightColor,
                progressColor: draft || !me ? secondaryColor : textPrimaryColor,
                barWidth: 3,
                barRadius: 6,
                dragToSeek: true,
                barGap: 4,
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

{#snippet togglePlayButton()}
    {@const color = me && !draft ? ColourVars.textPrimary : ColourVars.textSecondary}
    <IconButton padding="xs" size={"lg"} onclick={togglePlay} mode={"transparent"}>
        {#snippet icon()}
            {#if playing}
                <Pause {color} />
            {:else}
                <Play {color} />
            {/if}
        {/snippet}
    </IconButton>
{/snippet}

{#snippet remainingTime()}
    {@const currentColor = me && !draft ? "textPrimary" : "secondary"}
    {@const durationColor = me && !draft ? "primaryLight" : "textSecondary"}
    <Container gap={"xxs"} padding={["zero", "sm"]}>
        <ChatFootnote colour={currentColor} width={"hug"}>
            {currentTime ?? "0:00"}
        </ChatFootnote>
        <ChatFootnote colour={durationColor} width={"hug"}>/</ChatFootnote>
        <ChatFootnote colour={durationColor} width={"hug"}>
            {formatTime(duration)}
        </ChatFootnote>
    </Container>
{/snippet}

{#snippet messageTextContent()}
    {#if textContent?.text}
        <TextContent
            content={textContent}
            {me}
            {reply}
            fill={false}
            {blockLevelMarkdown}
            {edited}
            showPreviews={false}
            isPreview={draft || reply} />
    {/if}
{/snippet}

{#snippet waveformView()}
    {@const bgColor = hasContent
        ? me
            ? ColourVars.primaryMuted
            : ColourVars.background1
        : "transparent"}
    <Row
        minWidth={"18rem"}
        width={"fill"}
        padding={["sm", "xs", hasContent ? "sm" : "xxs", "zero"]}
        borderRadius={hasContent ? [me ? "lg" : "md", !me ? "lg" : "md", "md", "md"] : "zero"}
        backgroundColor={bgColor}>
        <Row width="hug" mainAxisAlignment={"center"}>
            {@render togglePlayButton()}
        </Row>
        <Row width="fill">
            <Column>
                <div
                    bind:this={waveformDiv}
                    class="waveform"
                    class:has_content={hasContent}
                    class:me
                    class:draft>
                </div>
                {@render remainingTime()}
            </Column>
        </Row>
        <Row width="hug" padding={["xs", "zero"]}>
            <Container
                backgroundColor={me && !draft ? ColourVars.primaryLight : ColourVars.textTertiary}
                borderRadius={"xl"}
                mainAxisAlignment={"center"}
                onClick={cycleSpeed}
                gap={"xs"}
                height="hug"
                width={{ size: "3rem" }}
                padding={["xs", "md"]}
                crossAxisAlignment={"center"}>
                <Body
                    width={"hug"}
                    fontWeight={"bold"}
                    colour={me && !draft ? "myChatBubble" : "textPrimary"}>
                    x{speed}
                </Body>
            </Container>
        </Row>
    </Row>
{/snippet}

{#if reply}
    <!-- User is replying to an audio attached message, and this is how reply is rendered -->
    <Column gap="xxs">
        {@render title?.()}
        <Row gap="xs" crossAxisAlignment="center">
            <MicrophoneOutline
                size="1rem"
                color={me ? ColourVars.secondaryLight : ColourVars.primaryLight} />
            <BodySmall colour={textHighlightColour}>
                <!-- TODO i18n -->
                <Translatable resourceKey={i18nKey("Audio message")} /> ({formatTime(duration)})
            </BodySmall>
        </Row>
    </Column>
{:else if draft}
    <!-- User is drafting a new message with audio attached, so we render it here -->
    <Column padding="xs">
        <Row
            supplementalClass="audio_draft_contents"
            padding={["md", "sm", "sm", "sm"]}
            borderRadius="lg"
            background={ColourVars.background1}>
            {@render waveformView()}
            <div class="close" class:rtl={$rtlStore}>
                <IconButton size="sm" onclick={onRemove}>
                    {#snippet icon()}
                        <Close color={ColourVars.textPrimary} />
                    {/snippet}
                </IconButton>
            </div>
        </Row>
    </Column>
{:else}
    <!-- Render a message with audio attached -->
    {@render waveformView()}
    {@render messageTextContent()}
{/if}

<style lang="scss">
    :global {
        .audio_draft_contents {
            // TODO apply this to all attachment variants
            animation: grow-height 300ms ease-out forwards;
            will-change: max-height, opacity;
        }
        .waveform {
            width: 100%;
            padding: 0 0.5rem;

            ::part(scroll),
            ::part(wrapper) {
                overflow: visible;
            }

            ::part(cursor) {
                height: 100%;
                width: 1rem;
                background-color: transparent;
            }

            ::part(cursor):before {
                content: "";
                width: 0.75rem;
                height: 0.75rem;
                display: block;
                position: relative;
                top: 50%;
                left: -0.5rem;
                transform: translateY(-50%);
                border-radius: var(--rad-circle);
                background-color: var(--secondary);
                border-width: var(--bw-thick);
                border-style: solid;
                border-color: var(--background-1);
            }

            ::part(region) {
                width: 0.125rem;
                background-color: var(--primary);
            }

            &.me:not(.draft) {
                ::part(cursor):before {
                    background-color: var(--text-primary);
                }

                &.has_content ::part(cursor):before {
                    border-color: var(--primary-muted);
                }

                &:not(.has_content) ::part(cursor):before {
                    border-color: var(--my-chat-bubble);
                }
            }
        }
    }

    .close {
        position: absolute;
        top: -0.25rem;

        &:not(.rtl) {
            right: -0.25rem;
        }

        &.rtl {
            left: -0.25rem;
        }
    }
</style>
