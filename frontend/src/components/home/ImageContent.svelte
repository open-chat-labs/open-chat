<svelte:options immutable={true} />

<script lang="ts">
    import { rtlStore } from "../../stores/rtl";
    import type { ImageContent } from "../../domain/chat/chat";
    import ArrowExpand from "svelte-material-icons/ArrowExpand.svelte";
    import ArrowCollapse from "svelte-material-icons/ArrowCollapse.svelte";
    import ContentCaption from "./ContentCaption.svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import { isTouchDevice } from "../../utils/devices";

    export let content: ImageContent;
    export let fill: boolean;
    export let draft: boolean = false;
    export let reply: boolean = false;
    export let pinned: boolean = false;
    export let height: number | undefined = undefined;
    export let intersecting: boolean = true;
    export let edited: boolean;

    let imgElement: HTMLImageElement;
    let zoom = false;
    let withCaption = content.caption !== undefined && content.caption !== "";
    let landscape = content.height < content.width;
    let zoomedWidth: number;
    let zoomedHeight: number;

    $: zoomable = !draft && !reply && !pinned;

    function onClick() {
        if (!isTouchDevice) {
            toggleZoom();
        }
    }

    function onDoubleClick() {
        if (isTouchDevice) {
            toggleZoom();
        }
    }

    function toggleZoom() {
        zoom = !zoom;
        if (zoom) {
            recalculateZoomedDimensions();
        }
    }

    function recalculateZoomedDimensions() {
        const contentAspectRatio = content.width / content.height;
        let imageWidth = Math.max(400, content.width);
        let imageHeight = Math.max(400, content.height);
        if (landscape) {
            imageWidth = Math.min(window.innerWidth, imageWidth);
            imageHeight = imageWidth / contentAspectRatio;
            if (imageHeight > window.innerHeight) {
                imageHeight = window.innerHeight;
                imageWidth = imageHeight * contentAspectRatio;
            }
        } else {
            imageHeight = Math.min(window.innerHeight, imageHeight);
            imageWidth = imageHeight * contentAspectRatio;
            if (imageWidth > window.innerWidth) {
                imageWidth = window.innerWidth;
                imageHeight = imageWidth / contentAspectRatio;
            }
        }
        zoomedWidth = imageWidth;
        zoomedHeight = imageHeight;
    }
</script>

<svelte:window
    on:resize={recalculateZoomedDimensions}
    on:orientationchange={recalculateZoomedDimensions} />

{#if content.blobUrl !== undefined}
    <div class="img-wrapper">
        <img
            bind:this={imgElement}
            on:click={onClick}
            on:dblclick|stopPropagation={onDoubleClick}
            on:error={() => (imgElement.src = content.thumbnailData)}
            class:landscape
            class:fill
            class:withCaption
            class:draft
            class:reply
            class:zoomable
            class:rtl={$rtlStore}
            style={height === undefined ? undefined : `height: ${height}px`}
            src={intersecting ? content.blobUrl : content.thumbnailData}
            alt={content.caption} />

        {#if zoomable}
            <div class="expand" class:rtl={$rtlStore} class:zoomed={zoom} on:click={toggleZoom}>
                <ArrowExpand size={"1em"} color={"#fff"} />
            </div>
        {/if}
    </div>
{/if}

<ContentCaption caption={content.caption} {edited} {reply} />

{#if zoomable && zoom}
    <Overlay on:close={() => (zoom = false)} dismissible={true} alignBottomOnMobile={false}>
        <ModalContent
            hideHeader={true}
            hideFooter={true}
            fill={true}
            fitToContent={true}
            fixedWidth={false}>
            <span class="body" slot="body">
                <img
                    class="zoomed"
                    class:landscape
                    width={zoomedWidth}
                    height={zoomedHeight}
                    on:click={onClick}
                    on:dblclick={onDoubleClick}
                    on:error={() => (imgElement.src = content.thumbnailData)}
                    src={content.blobUrl}
                    alt={content.caption} />
                <div class="expand" class:rtl={$rtlStore} class:zoomed={zoom} on:click={toggleZoom}>
                    <ArrowCollapse size={"1em"} color={"#fff"} />
                </div>
                {#if withCaption}
                    <div class="caption">
                        {content.caption}
                    </div>
                {/if}
            </span>
        </ModalContent>
    </Overlay>
{/if}

<style type="text/scss">
    .img-wrapper {
        position: relative;
    }

    .body {
        display: flex;
        position: relative;
    }

    .caption {
        position: absolute;
        background-color: rgba(0, 0, 0, 0.2);
        color: #fff;
        width: 100%;
        padding: $sp2 $sp4;
        top: 0;
        text-align: center;
    }

    .expand {
        border-radius: 0 $sp4 0 $sp4;

        cursor: zoom-in;
        &.zoomed {
            cursor: zoom-out;
            border-bottom-left-radius: 0;
        }

        &.rtl {
            right: 0;
            left: unset;
            border-radius: $sp4 0 $sp4 0;
            &.zoomed {
                border-bottom-right-radius: 0;
            }
        }

        position: absolute;
        padding: $sp2 $sp4;
        bottom: 0;
        left: 0;
        background-color: rgba(0, 0, 0, 0.3);
        color: #fff;
    }

    img.zoomable.zoomed {
        cursor: zoom-out;
    }

    img.zoomable:not(.zoomed) {
        cursor: zoom-in;
    }

    img:not(.zoomed) {
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
            width: -webkit-fill-available;
            height: 100%;
        }

        &.reply {
            max-width: 90px;
            max-height: none;
            height: auto;
            float: right;
            margin-left: $sp3;
            margin-right: 0;
        }

        &.rtl.reply {
            float: left;
            margin-left: 0;
            margin-right: $sp3;
        }

        &:not(.landscape).reply {
            max-width: none;
            max-height: 90px;
            width: auto;
        }
    }
</style>
