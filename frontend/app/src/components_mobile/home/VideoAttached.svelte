<script lang="ts">
    import { Column, ColourVars, IconButton } from "component-lib";
    import { rtlStore } from "../../stores/rtl";
    import type { VideoContent } from "openchat-client";
    import { setPlayingMedia } from "../../utils/media";
    import Close from "svelte-material-icons/Close.svelte";

    interface Props {
        content: VideoContent;
        height?: number | undefined;
        onRemove?: () => void;
    }

    let { content, height = undefined, onRemove }: Props = $props();
    let videoPlayer: HTMLVideoElement | undefined = $state();
    let landscape = content.height < content.width;

    function onPlay() {
        if (videoPlayer) {
            setPlayingMedia(videoPlayer);
        }
    }
</script>

<Column width={"fill"}>
    <div class="video_preview">
        <div class="video_wrapper" class:rtl={$rtlStore}>
            <video
                preload="none"
                poster={content.imageData.blobUrl}
                class:landscape
                class="video"
                style={height === undefined ? undefined : `height: ${height}px`}
                controls
                onplay={onPlay}
                bind:this={videoPlayer}>
                <track kind="captions" />
                {#if content.videoData.blobUrl}
                    <source src={content.videoData.blobUrl} />
                {/if}
            </video>
        </div>

        <div class="close">
            <IconButton size="sm" mode={"dark"} onclick={onRemove}>
                {#snippet icon()}
                    <Close color={ColourVars.textPrimary} />
                {/snippet}
            </IconButton>
        </div>
    </div>
</Column>

<style lang="scss">
    .video_preview {
        width: 100%;
        padding: var(--sp-xs);
        animation: grow-height 300ms ease-out forwards;
        will-change: max-height, opacity;

        .video_wrapper {
            min-height: 4rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: var(--sp-xs);
            background-color: var(--background-0);
            border-radius: var(--rad-lg) var(--rad-lg) var(--rad-lg) var(--rad-lg);
        }

        .video {
            display: flex;
            max-width: 14rem;
            max-height: 14rem;
            overflow: hidden;
            border-radius: var(--rad-md);
        }
    }

    .close {
        position: absolute;
        top: var(--sp-xs);
        right: var(--sp-xs);
    }

    @keyframes grow-height {
        from {
            max-height: 0;
            opacity: 0;
        }
        100% {
            max-height: 15rem;
            opacity: 1;
        }
    }
</style>
