<script lang="ts">
    import { IconButton, doubleTap } from "component-lib";
    import type { ImageContent, MemeFighterContent } from "@client";
    import { onMount } from "svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { popHistoryStateWithAction, pushDummyHistoryState } from "../../utils/history";
    import { getProxyAdjustedBlobUrl } from "../../utils/media";
    import { zoomImage, type ImageZoom } from "@src/core/zoom";

    // TODO add reactions, forward, reply and other menu and conversation options to this screen!

    interface Props {
        imageContent: ImageContent | MemeFighterContent;
        onClose: () => void;
    }

    let { imageContent, onClose }: Props = $props();

    let normalisedImage = $derived(imageContent ? normalisedImageContent(imageContent) : undefined);
    let adjustedUrl = $derived(
        normalisedImage ? getProxyAdjustedBlobUrl(normalisedImage.url) : undefined,
    );

    let container: HTMLDivElement;
    let imageWidth = $state(0);
    let imageHeight = $state(0);
    let zoom: ImageZoom;

    onMount(() => {
        zoom = zoomImage(container, () => ({ width: imageWidth, height: imageHeight }));

        pushDummyHistoryState("zoomed_image_state");
        return () => {
            zoom.destroy();
            // This will try and pop the history state, if it's still there!
            popHistoryStateWithAction("zoomed_image_state");
        };
    });

    $effect(() => {
        if (imageHeight > 0 && imageHeight < window.innerHeight) {
            zoom.panOnlyWhenZoomed();
        }
    });

    function normalisedImageContent(content: ImageContent | MemeFighterContent) {
        switch (content.kind) {
            case "image_content":
                return {
                    url: content.blobUrl,
                    caption: content.caption,
                    fallback: content.thumbnailData,
                    loadMsg: "loadImage",
                };
            case "meme_fighter_content":
                return {
                    url: content.url,
                    caption: undefined,
                    fallback: "/assets/memefighter.svg",
                    loadMsg: "loadMeme",
                };
        }
    }

    function onDoubleTap() {
        zoom.toggle();
    }
</script>

<svelte:window onpopstate={onClose} />

<div class="zoomed_image" class:vcentre={window.innerHeight > imageHeight}>
    <!-- <div onclick={onClose} class="bg" style={`background-image: url(${adjustedUrl})`}></div> -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div onclick={onClose} class="bg"></div>
    <div bind:this={container} class="panzoom_frame" use:doubleTap={onDoubleTap}>
        <img
            class="image"
            src={adjustedUrl}
            alt="zoomable"
            draggable="false"
            bind:clientHeight={imageHeight}
            bind:clientWidth={imageWidth} />
    </div>

    <div class="close">
        <IconButton onclick={onClose}>
            {#snippet icon(color)}
                <Close {color} />
            {/snippet}
        </IconButton>
    </div>
</div>

<style lang="scss">
    .zoomed_image {
        @include z-index("overlay");
        display: flex;
        position: fixed;
        inset: 0;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: black;
        touch-action: none;
        margin: 0;
        opacity: 1;
        animation: slide-up 200ms ease-out forwards;

        &.vcentre {
            justify-content: center;
            align-items: center;
        }

        .bg {
            position: absolute;
            inset: -10%;
            background-size: cover;
            background-position: center;
            filter: blur(10px);
            transform: scale(1.1);
        }

        .bg::after {
            content: "";
            position: absolute;
            inset: 0;
            background: rgba(0, 0, 0, 0.25);
        }

        .close {
            position: absolute;
            z-index: 2;
            top: calc(var(--device-status-bar-height) + var(--sp-md));
            right: var(--sp-md);
        }
    }

    .panzoom_frame {
        width: 100%;
        overflow: hidden;
        touch-action: none;
        -webkit-user-select: none; /* iOS */
        user-select: none;
        height: fit-content;

        .image {
            width: 100%;
            height: auto;
            display: block;
            min-width: 100%;
            pointer-events: auto;
        }
    }
</style>
