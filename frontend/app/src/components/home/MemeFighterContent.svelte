<svelte:options immutable />

<script lang="ts">
    import { rtlStore } from "../../stores/rtl";
    import ArrowExpand from "svelte-material-icons/ArrowExpand.svelte";
    import ArrowCollapse from "svelte-material-icons/ArrowCollapse.svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import { isTouchDevice } from "../../utils/devices";
    import { lowBandwidth } from "../../stores/settings";
    import Button from "../Button.svelte";
    import { _ } from "svelte-i18n";
    import type { MemeFighterContent } from "openchat-client";

    export let content: MemeFighterContent;
    export let reply: boolean = false;
    export let height: number | undefined = undefined;
    export let intersecting: boolean = true;

    let zoom = false;
    let landscape = content.height < content.width;
    let zoomedWidth: number;
    let zoomedHeight: number;
    let placeholder = "/assets/memefighter.svg";
    let img: HTMLImageElement | undefined;

    $: hidden = $lowBandwidth;
    $: zoomable = !reply;

    $: console.log("Height: ", content.height);

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

    function error() {
        if (img) {
            img.src = placeholder;
        }
    }
</script>

<svelte:window
    on:resize={recalculateZoomedDimensions}
    on:orientationchange={recalculateZoomedDimensions} />

<div class="img-wrapper">
    {#if hidden}
        <div class="mask">
            {#if !reply}
                <div class="reveal">
                    <Button on:click={() => (hidden = false)}>{$_("loadImage")}</Button>
                </div>
            {/if}
        </div>
    {/if}
    <img
        bind:this={img}
        on:click={onClick}
        on:dblclick|stopPropagation={onDoubleClick}
        on:error={error}
        class:landscape
        class:reply
        class:zoomable={zoomable && !hidden}
        class:rtl={$rtlStore}
        style={height === undefined ? undefined : `height: ${height}px`}
        src={intersecting && !hidden ? content.url : placeholder} />

    {#if zoomable && !hidden}
        <div class="expand" class:rtl={$rtlStore} class:zoomed={zoom} on:click={toggleZoom}>
            <ArrowExpand size={"1em"} color={"#fff"} />
        </div>
    {/if}
</div>

{#if zoomable && zoom}
    <Overlay on:close={() => (zoom = false)} dismissible alignBottomOnMobile={false}>
        <ModalContent hideHeader hideFooter fill fitToContent fixedWidth={false}>
            <span class="body" slot="body">
                <img
                    class="zoomed"
                    class:landscape
                    width={zoomedWidth}
                    height={zoomedHeight}
                    on:click={onClick}
                    on:dblclick={onDoubleClick}
                    src={content.url} />
                <div class="expand" class:rtl={$rtlStore} class:zoomed={zoom} on:click={toggleZoom}>
                    <ArrowCollapse size={"1em"} color={"#fff"} />
                </div>
            </span>
        </ModalContent>
    </Overlay>
{/if}

<style lang="scss">
    $radius: $sp3;

    .img-wrapper {
        position: relative;
    }

    .mask {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        width: 100%;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        background: linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.5));
    }

    .reveal {
        position: absolute;
        top: calc(50% - 20px);
        width: 100%;
        text-align: center;
    }

    .body {
        display: flex;
        position: relative;
    }

    .expand {
        border-radius: 0 $radius 0 $radius;

        cursor: zoom-in;
        &.zoomed {
            cursor: zoom-out;
            border-bottom-left-radius: 0;
        }

        &.rtl {
            right: 0;
            left: unset;
            border-radius: $radius 0 $radius 0;
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
