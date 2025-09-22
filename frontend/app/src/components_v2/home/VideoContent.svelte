<script lang="ts">
    import { rtlStore } from "../../stores/rtl";
    import type { VideoContent } from "openchat-client";
    import ContentCaption from "./ContentCaption.svelte";
    import { setPlayingMedia } from "../../utils/media";

    interface Props {
        content: VideoContent;
        fill: boolean;
        draft?: boolean;
        reply?: boolean;
        height?: number | undefined;
        edited: boolean;
        blockLevelMarkdown?: boolean;
    }

    let {
        content,
        fill,
        draft = false,
        reply = false,
        height = undefined,
        edited,
        blockLevelMarkdown = false,
    }: Props = $props();

    let videoPlayer: HTMLVideoElement | undefined = $state();
    let withCaption = content.caption !== undefined && content.caption !== "";
    let landscape = content.height < content.width;

    function onPlay() {
        if (videoPlayer) {
            setPlayingMedia(videoPlayer);
        }
    }
</script>

<div class="video" class:reply class:rtl={$rtlStore}>
    <video
        preload="none"
        poster={content.imageData.blobUrl}
        class:landscape
        class:fill
        class:withCaption
        class:draft
        class:reply
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

<ContentCaption caption={content.caption} {edited} {blockLevelMarkdown} />

<style lang="scss">
    .video {
        position: relative;
        cursor: pointer;

        &.reply {
            float: right;
            margin-left: $sp3;
            margin-right: 0;
        }

        &.rtl.reply {
            float: left;
            margin-left: 0;
            margin-right: $sp3;
        }

        video {
            width: 100%;
            display: block;

            &:not(.landscape) {
                min-height: 90px;
                min-width: 0px;
            }

            &:not(.fill) {
                border-radius: $sp4;
            }

            &.withCaption {
                margin-bottom: $sp2;
            }

            &.draft {
                max-width: calc(var(--vh, 1vh) * 50);
                max-height: none;
                height: auto;
            }

            &:not(.landscape).draft {
                max-width: none;
                max-height: calc(var(--vh, 1vh) * 50);
                width: auto;
                height: 100%;
            }

            &.reply {
                max-width: 90px;
                max-height: none;
                height: auto;
            }

            &:not(.landscape).reply {
                max-width: none;
                max-height: 90px;
                width: auto;
            }
        }
    }
</style>
