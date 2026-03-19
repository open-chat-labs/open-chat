<script lang="ts">
    import { ColourVars, ChatFootnote } from "component-lib";
    import { rtlStore } from "../../stores/rtl";
    import { publish, type TextContent as TextContentType } from "openchat-client";
    import type { VideoContent } from "openchat-client";
    import { getProxyAdjustedBlobUrl, getVideoDuration } from "../../utils/media";
    import PlayCircleOutline from "svelte-material-icons/PlayCircleOutline.svelte";
    import VideoOutline from "svelte-material-icons/VideoOutline.svelte";
    import TextContent from "./TextContent.svelte";

    interface Props {
        content: VideoContent;
        fill: boolean;
        me: boolean;
        reply?: boolean;
        height?: number | undefined;
        edited: boolean;
        blockLevelMarkdown?: boolean;
    }

    let {
        content,
        fill,
        me,
        reply = false,
        height = undefined,
        edited,
        blockLevelMarkdown = false,
    }: Props = $props();

    let landscape = $derived(content.height < content.width);
    let imageUrl = $derived(getProxyAdjustedBlobUrl(content.imageData.blobUrl));
    let videoUrl = $derived(getProxyAdjustedBlobUrl(content.videoData.blobUrl));
    let videoDuration = $state<string>();
    let videoPosterWidth = $state(0); // TODO Should we expect very narrow videos, below 150px width resized?
    let textContent = $derived<TextContentType | undefined>(
        !!content.caption ? { kind: "text_content", text: content.caption ?? "" } : undefined,
    );

    $effect(() => {
        if (videoUrl && videoDuration === undefined) {
            getVideoDuration(videoUrl).then((duration) => {
                videoDuration = formatDuration(Math.round(duration));
            });
        }
    });

    function formatDuration(duration: number): string {
        if (duration === undefined) return "--:--";

        const pad = (val: number) => `${val < 10 ? "0" : ""}${val}`;
        const mins = Math.floor(duration / 60);
        const secs = duration % 60;
        return `${pad(mins)}:${pad(secs)}`;
    }

    function playVideo() {
        publish("playVideo", content);
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_interactive_supports_focus -->
<div role="button" class="video_content" class:reply class:rtl={$rtlStore} onclick={playVideo}>
    <img
        bind:clientWidth={videoPosterWidth}
        alt="..."
        class="preview_img"
        class:landscape
        class:fill
        class:me
        src={imageUrl}
        style={height === undefined ? undefined : `height: ${height}px`} />

    <div class="play_icon">
        <PlayCircleOutline class="play" size="3rem" color={ColourVars.textPrimary} />
    </div>

    <div class="duration">
        <VideoOutline size="1rem" color={ColourVars.textPrimary} />
        <ChatFootnote>{videoDuration ?? "--:--"}</ChatFootnote>
    </div>
</div>

{#if textContent}
    <TextContent
        content={textContent}
        {me}
        {fill}
        {blockLevelMarkdown}
        {edited}
        maxWidth={videoPosterWidth}
        showPreviews={false} />
{/if}

<style lang="scss">
    .video_content {
        display: flex;
        position: relative;

        .preview_img {
            width: 100%;
            border-radius: var(--rad-lg) var(--rad-lg) var(--rad-md) var(--rad-md);

            &.me {
                border-top-right-radius: var(--rad-sm);

                &.fill {
                    border-bottom-left-radius: var(--rad-lg);
                    border-bottom-right-radius: var(--rad-lg);
                }
            }

            &:not(.me) {
                border-top-left-radius: var(--rad-sm);

                &:not(.fill) {
                    border-bottom-right-radius: var(--rad-md);
                    border-bottom-left-radius: var(--rad-md);
                }
            }

            &:not(.landscape) {
                min-height: 6rem;
                min-width: 0;
            }
        }

        .play_icon {
            position: absolute;
            display: flex;
            top: 50%;
            left: 50%;
            padding: var(--sp-md);
            border-radius: var(--rad-circle);
            transform: translate(-50%, -50%);
            // background: rgba(50, 50, 50, 0.5);
            background: radial-gradient(
                circle,
                rgba(50, 50, 50, 0.75) 0%,
                rgba(50, 50, 50, 0.5) 50%,
                rgba(50, 50, 50, 0) 75%
            );
        }

        .duration {
            position: absolute;
            bottom: var(--sp-xxs);
            left: var(--sp-sm);
            display: flex;
            gap: var(--sp-xs);
            align-items: center;
            height: 0.75rem;
        }
    }

    :global {
        .video_content {
            // Same CSS is set for message metadata
            .duration {
                text-shadow: 0 0 0.125rem var(--backdrop);

                path {
                    filter: drop-shadow(0 0 0.125rem var(--background-0));
                }
            }
        }
    }
</style>
