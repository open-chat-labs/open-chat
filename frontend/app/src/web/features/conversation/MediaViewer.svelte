<!-- A message's image, GIF or video full screen, as the mobile app shows it (ZoomedImage,
     ZoomedVideo): an image pans and zooms (core/zoom: pinch or wheel, double click to zoom in or
     out), a video plays with its controls (one at a time), a GIF loops. Esc, the close button or a
     click outside the media closes it. TODO(design): the design has no media viewer. -->
<script lang="ts">
    import IconButton from "@openchat/ui/src/lib/components/IconButton.svelte";
    import { modal } from "@openchat/ui/src/lib/behaviours/modal";
    import { zoomImage, type ImageZoom } from "@src/core/zoom";
    import { getProxyAdjustedBlobUrl, setPlayingMedia } from "@src/utils/media";
    import { onMount } from "svelte";
    import type { MediaContent } from "./conversation.adapter";

    interface Props {
        content: MediaContent;
        onClose: () => void;
    }

    let { content, onClose }: Props = $props();

    const image = $derived(
        content.kind === "image_content"
            ? { src: getProxyAdjustedBlobUrl(content.blobUrl), fallback: content.thumbnailData }
            : content.kind === "meme_fighter_content"
              ? { src: content.url, fallback: "/assets/memefighter.svg" }
              : undefined,
    );

    let frame = $state<HTMLDivElement>();
    let imageWidth = $state(0);
    let imageHeight = $state(0);
    let zoom: ImageZoom | undefined;

    onMount(() => {
        if (frame === undefined) return;
        zoom = zoomImage(frame, () => ({ width: imageWidth, height: imageHeight }));
        return () => zoom?.destroy();
    });

    $effect(() => {
        if (imageHeight > 0 && imageHeight < window.innerHeight) zoom?.panOnlyWhenZoomed();
    });

    // a broken image falls back to its thumbnail, a meme to its placeholder
    let failed = $state(false);
</script>

<div class="viewer" role="dialog" aria-modal="true" use:modal={onClose}>
    <div class="backdrop" onclick={onClose} aria-hidden="true"></div>
    {#if image !== undefined}
        <div class="frame" bind:this={frame} ondblclick={() => zoom?.toggle()} role="presentation">
            <img
                class="media"
                src={failed ? image.fallback : image.src}
                alt=""
                draggable="false"
                onerror={() => (failed = true)}
                bind:clientWidth={imageWidth}
                bind:clientHeight={imageHeight}
            />
        </div>
    {:else if content.kind === "video_content"}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video
            class="media"
            src={getProxyAdjustedBlobUrl(content.videoData.blobUrl)}
            poster={getProxyAdjustedBlobUrl(content.imageData.blobUrl)}
            controls
            autoplay
            playsinline
            onplay={(e) => setPlayingMedia(e.currentTarget)}
        ></video>
    {:else if content.kind === "giphy_content"}
        <video
            class="media"
            src={content.desktop.url}
            autoplay
            loop
            muted
            playsinline
            aria-label={content.title}
        ></video>
    {/if}
    <div class="close">
        <IconButton icon="close" label="ui.common.close" onClick={onClose} />
    </div>
</div>

<style>
    .viewer {
        position: fixed;
        inset: 0;
        z-index: 90;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        background: #000;
        touch-action: none;
    }

    .backdrop {
        position: absolute;
        inset: 0;
    }

    .frame {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        max-width: 100%;
        max-height: 100%;
    }

    .media {
        position: relative;
        display: block;
        max-width: 100vw;
        max-height: 100vh;
        object-fit: contain;
        user-select: none;
    }

    .close {
        position: absolute;
        top: var(--space-16);
        inset-inline-end: var(--space-16);
    }
</style>
