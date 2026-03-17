<script lang="ts">
    import { onMount } from "svelte";
    import { IconButton, doubleTap } from "component-lib";
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
    let imageWidth = $state(0);
    let imageHeight = $state(0);
    let panzoomInstance: ReturnType<typeof Panzoom>;

    const HISTORY_ACTION = "zoomed-image-state";
    const DEFAULT_SCALE = 1;
    const SCALE_EPSILON = 0.02;

    onMount(() => {
        panzoomInstance = Panzoom(container, {
            minScale: 1,
            maxScale: 5,
            animate: true,
            duration: 200,
            easing: "cubic-bezier(0.25, 0.1, 0.25, 1)",
            zoomOnPointer: true, // zoom toward cursor/fingers
            touchAction: "none",
            pinchAndPan: true,
            smooth: true,
        });

        container.addEventListener("panzoomend", (_e: any) => {
            const currentScale = panzoomInstance.getScale();
            currentScale <= DEFAULT_SCALE + SCALE_EPSILON && imageHeight <= window.innerHeight
                ? panzoomInstance.reset({ animate: true })
                : snapToClosestEdge(currentScale);
        });

        pushDummyHistoryState(HISTORY_ACTION);
        return () => {
            // This will try and pop the history state, if it's still there!
            popHistoryStateWithAction(HISTORY_ACTION);
        };
    });

    $effect(() => {
        if (imageHeight > 0 && imageHeight < window.innerHeight) {
            console.log("IMG H", imageHeight, window.innerHeight);
            panzoomInstance.setOptions({ panOnlyWhenZoomed: true });
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

    // Finds the closest edge to snap to, if there is space on any side of the
    // image we're paning/zooming!
    function snapToClosestEdge(scale: number) {
        const rect = container.getBoundingClientRect();

        const spaceLeft = rect.x;
        const spaceRight = imageWidth - rect.x - rect.width;

        const spaceTop = rect.y;
        const spaceBottom = window.innerHeight - rect.y - rect.height;

        let snapXBy = 0;
        let snapYBy = 0;

        // Snap to left
        if (spaceLeft > 0 && spaceRight < 0) {
            snapXBy = -spaceLeft;
        }
        // Snap to right
        else if (spaceLeft < 0 && spaceRight > 0) {
            snapXBy = spaceRight;
        }

        // Snap to top or bottom depending on how much the image is paned outside
        // the viewport, compared to how much space there is to the edge on the
        // oposite side. Abs values for spaces are also taken into account since
        // their relationship determines how the image must pan.
        if (spaceTop > 0 && spaceBottom < 0) {
            snapYBy = spaceTop > Math.abs(spaceBottom) ? spaceBottom : -spaceTop;
        }
        // Snap to bottom
        else if (spaceTop < 0 && spaceBottom > 0) {
            // Is there more space to bottom than the image overflows above tells
            // us to move to the top, otherwise move to the bottom.
            snapYBy = Math.abs(spaceTop) < spaceBottom ? Math.abs(spaceTop) : spaceBottom;
        }

        if (snapXBy || snapYBy) {
            panzoomInstance.pan(snapXBy / scale, snapYBy / scale, {
                animate: true,
                relative: true,
            });
        }
    }

    function onDoubleTap() {
        const currentScale = panzoomInstance.getScale();
        currentScale <= DEFAULT_SCALE + SCALE_EPSILON
            ? panzoomInstance.zoom(2.5, { animate: true })
            : panzoomInstance.reset({ animate: true });
    }
</script>

<svelte:window onpopstate={onClose} />

<div class="zoomed_image" class:vcentre={window.innerHeight > imageHeight}>
    <!-- <div onclick={onClose} class="bg" style={`background-image: url(${adjustedUrl})`}></div> -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div onclick={onClose} class="bg"></div>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
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
