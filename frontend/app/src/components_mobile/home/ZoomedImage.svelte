<script lang="ts">
    import { onMount } from "svelte";
    import { IconButton } from "component-lib";
    import Close from "svelte-material-icons/Close.svelte";
    import { getProxyAdjustedBlobUrl } from "../../utils/media";
    import { pushDummyHistoryState, popHistoryStateWithAction } from "../../utils/history";
    import Panzoom from "@panzoom/panzoom";
    import type { MemeFighterContent, ImageContent } from "openchat-client";

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
    let containerStartWidth = 0;
    let panzoomInstance: ReturnType<typeof Panzoom>;

    const HISTORY_ACTION = "zoomed-image-state";
    const DEFAULT_SCALE = 1;
    const SCALE_EPSILON = 0.02;

    onMount(() => {
        panzoomInstance = Panzoom(container, {
            minScale: 1,
            maxScale: 6,
            animate: true,
            duration: 200,
            easing: "cubic-bezier(0.25, 0.1, 0.25, 1)",
            zoomOnPointer: true, // zoom toward cursor/fingers
            touchAction: "none", // important
            pinchAndPan: true,
            panOnlyWhenZoomed: true,
            smooth: true,
            zoomDoubleClickSpeed: 1, // disable dblclick zoom if unwanted
        });

        containerStartWidth = container.getBoundingClientRect().width;
        container.addEventListener("panzoomend", (_e: any) => {
            const currentScale = panzoomInstance.getScale();
            currentScale <= DEFAULT_SCALE + SCALE_EPSILON
                ? panzoomInstance.reset({ animate: true })
                : snapToClosestEdge(currentScale);
        });

        pushDummyHistoryState(HISTORY_ACTION);
        return () => {
            // This will try and pop the history state, if it's still there!
            popHistoryStateWithAction(HISTORY_ACTION);
        };
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

    function snapToClosestEdge(scale: number) {
        // Do not snap if we're (almost) at default scale
        if (scale <= DEFAULT_SCALE + SCALE_EPSILON) return;

        const rect = container.getBoundingClientRect();
        const spaceLeft = rect.x;
        const spaceRight = Math.abs(rect.x) + containerStartWidth - rect.width;

        // We either snap left or right, or nowhere if there's no space.
        const snapBy =
            spaceLeft > 0 ? -spaceLeft / scale : spaceRight > 0 ? spaceRight / scale : undefined;

        if (snapBy) {
            panzoomInstance.pan(snapBy, 0, {
                animate: true,
                relative: true,
            });
        }
    }
</script>

<svelte:window onpopstate={onClose} />

<div class="zoomed_image">
    <!-- <div onclick={onClose} class="bg" style={`background-image: url(${adjustedUrl})`}></div> -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div onclick={onClose} class="bg"></div>
    <div bind:this={container} class="panzoom_frame">
        <img class="image" src={adjustedUrl} alt="zoomable" draggable="false" />
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

        display: flex;
        justify-content: center;
        align-items: center;

        opacity: 1;
        animation: slide-up 200ms ease-out forwards;

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

        .image {
            width: 100%;
            height: auto;
            display: block;
            min-width: 100%;
            pointer-events: auto;
        }
    }
</style>
