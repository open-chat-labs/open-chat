<script lang="ts">
    import { IconButton } from "component-lib";
    import type { VideoContent } from "openchat-client";
    import { onMount } from "svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { popHistoryStateWithAction, pushDummyHistoryState } from "../../utils/history";
    import { getProxyAdjustedBlobUrl, setPlayingMedia } from "../../utils/media";

    interface Props {
        videoContent: VideoContent;
        onClose: () => void;
    }

    let { videoContent, onClose }: Props = $props();

    let videoPlayer: HTMLVideoElement | undefined = $state();
    let landscape = $derived(videoContent.height < videoContent.width);
    let videoUrl = $derived(getProxyAdjustedBlobUrl(videoContent.videoData.blobUrl));

    function onPlay() {
        if (videoPlayer) {
            setPlayingMedia(videoPlayer);
        }
    }

    onMount(() => {
        pushDummyHistoryState("zoomed_video_state");
        return () => {
            // This will try and pop the history state, if it's still there!
            popHistoryStateWithAction("zoomed_video_state");
        };
    });
</script>

<svelte:window onpopstate={onClose} />

<div class="video-frame">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div onclick={onClose} class="bg"></div>
    <video
        preload="none"
        poster={videoUrl}
        class="player"
        class:landscape
        controls
        controlsList="nofullscreen"
        playsinline
        autoplay={true}
        onplay={onPlay}
        bind:this={videoPlayer}>
        <track kind="captions" />
        {#if videoUrl}
            <source src={videoUrl} />
        {/if}
    </video>
    <div class="close">
        <IconButton onclick={onClose}>
            {#snippet icon(color)}
                <Close {color} />
            {/snippet}
        </IconButton>
    </div>
</div>

<style lang="scss">
    .video-frame {
        @include z-index("overlay");
        position: fixed;
        inset: 0;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        display: flex;
        justify-content: center;
        align-items: center;
        opacity: 1;
        animation: slide-up 200ms ease-out forwards;

        .player {
            width: 100%;
            height: 100%;

            /* Forces hardware acceleration and proper layering */
            transform: translateZ(0);
            backface-visibility: hidden;

            /* Ensure the background isn't covering it */
            background-color: transparent !important;

            padding-top: var(--device-status-bar-height);
            padding-bottom: var(--device-nav-height);
        }

        .bg {
            position: absolute;
            inset: -10%;
            background-size: cover;
            background-position: center;
            background-color: black;
        }

        .close {
            position: absolute;
            z-index: 2;
            top: calc(var(--device-status-bar-height) + var(--sp-md));
            right: var(--sp-md);
        }
    }
</style>
