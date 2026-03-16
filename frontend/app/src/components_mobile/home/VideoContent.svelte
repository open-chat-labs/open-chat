<script lang="ts">
    import { ColourVars, Column, Body } from "component-lib";
    import { rtlStore } from "../../stores/rtl";
    import { publish } from "openchat-client";
    import type { VideoContent } from "openchat-client";
    import ContentCaption from "./ContentCaption.svelte";
    import { getProxyAdjustedBlobUrl, getVideoDuration } from "../../utils/media";
    import PlayCircleOutline from "svelte-material-icons/PlayCircleOutline.svelte";
    import VideoOutline from "svelte-material-icons/VideoOutline.svelte";

    interface Props {
        content: VideoContent;
        reply?: boolean;
        height?: number | undefined;
        edited: boolean;
        blockLevelMarkdown?: boolean;
    }

    let {
        content,
        reply = false,
        height = undefined,
        edited,
        blockLevelMarkdown = false,
    }: Props = $props();

    let landscape = $derived(content.height < content.width);
    let imageUrl = $derived(getProxyAdjustedBlobUrl(content.imageData.blobUrl));
    let videoUrl = $derived(getProxyAdjustedBlobUrl(content.videoData.blobUrl));
    let videoDuration = $state<string>();
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
<div role="button" class="video" class:reply class:rtl={$rtlStore} onclick={playVideo}>
    <img
        alt="..."
        class="preview_img"
        class:landscape
        src={imageUrl}
        style={height === undefined ? undefined : `height: ${height}px`} />

    <div class="play_icon">
        <PlayCircleOutline class="play" size="3rem" color={ColourVars.textPrimary} />
    </div>

    <div class="duration">
        <VideoOutline size="1.25rem" color={ColourVars.textPrimary} />
        <Body fontWeight="bold">{videoDuration ?? "--:--"}</Body>
    </div>
</div>

<Column padding={["zero", "sm"]}>
    <ContentCaption caption={content.caption} {edited} {blockLevelMarkdown} />
</Column>

<style lang="scss">
    .video {
        display: flex;
        position: relative;

        .preview_img {
            width: 100%;
            border-radius: var(--rad-sm) var(--rad-sm) var(--rad-md) var(--rad-md);

            &:not(.rtl) {
                border-top-left-radius: var(--rad-lg);
            }

            &.rtl {
                border-top-right-radius: var(--rad-lg);
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
            display: flex;
            gap: var(--sp-xs);
            position: absolute;
            bottom: var(--sp-xs);
            left: var(--sp-xs);
            align-items: center;
        }
    }
</style>
