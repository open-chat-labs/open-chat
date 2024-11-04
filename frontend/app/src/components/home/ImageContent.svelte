<svelte:options immutable />

<script lang="ts">
    import { rtlStore } from "../../stores/rtl";
    import type { ImageContent, MemeFighterContent } from "openchat-client";
    import ArrowExpand from "svelte-material-icons/ArrowExpand.svelte";
    import ArrowCollapse from "svelte-material-icons/ArrowCollapse.svelte";
    import ContentCaption from "./ContentCaption.svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import { isTouchDevice } from "../../utils/devices";
    import { lowBandwidth } from "../../stores/settings";
    import Button from "../Button.svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";

    export let content: ImageContent | MemeFighterContent;
    export let fill: boolean;
    export let draft: boolean = false;
    export let reply: boolean = false;
    export let pinned: boolean = false;
    export let height: number | undefined = undefined;
    export let intersecting: boolean = true;
    export let edited: boolean;
    export let blockLevelMarkdown: boolean = false;

    let imgElement: HTMLImageElement;
    let zoom = false;
    let withCaption =
        content.kind === "image_content" && content.caption !== undefined && content.caption !== "";
    let landscape = content.height < content.width;
    let zoomedWidth: number;
    let zoomedHeight: number;

    $: normalised = normaliseContent(content);
    $: hidden = $lowBandwidth && !draft;
    $: zoomable = !draft && !reply && !pinned;

    function normaliseContent(content: ImageContent | MemeFighterContent) {
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

{#if normalised.url !== undefined}
    <div class="img-wrapper">
        {#if hidden}
            <div class="mask">
                {#if !reply && !draft}
                    <div class="reveal">
                        <Button on:click={() => (hidden = false)}
                            ><Translatable resourceKey={i18nKey(normalised.loadMsg)} /></Button>
                    </div>
                {/if}
            </div>
        {/if}
        <img
            bind:this={imgElement}
            on:click={onClick}
            on:dblclick|stopPropagation={onDoubleClick}
            on:error={() => (imgElement.src = normalised.fallback)}
            class="unzoomed"
            class:landscape
            class:fill
            class:withCaption
            class:draft
            class:reply
            class:zoomable={zoomable && !hidden}
            class:rtl={$rtlStore}
            style={height === undefined ? undefined : `height: ${height}px`}
            src={intersecting && !hidden ? normalised.url : normalised.fallback}
            alt={normalised.caption} />

        {#if zoomable && !hidden}
            <div class="expand" class:rtl={$rtlStore} class:zoomed={zoom} on:click={toggleZoom}>
                <ArrowExpand size={"1em"} color={"#fff"} />
            </div>
        {/if}
    </div>
{/if}

<ContentCaption caption={normalised.caption} {edited} {blockLevelMarkdown} />

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
                    on:error={() => (imgElement.src = normalised.fallback)}
                    src={normalised.url}
                    alt={normalised.caption} />
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
            border-bottom-left-radius: var(--modal-rd);
        }

        &.rtl {
            right: 0;
            left: unset;
            border-radius: $radius 0 $radius 0;
            &.zoomed {
                border-bottom-right-radius: var(--modal-rd);
            }
        }

        position: absolute;
        padding: $sp2 $sp4;
        bottom: 0;
        left: 0;
        background-color: rgba(0, 0, 0, 0.3);
        color: #fff;
    }

    img.zoomable.unzoomed {
        cursor: zoom-in;
    }

    img.zoomed {
        border-radius: var(--modal-rd);
    }

    img.unzoomed {
        width: 100%;
        display: block;

        &:not(.landscape) {
            min-height: 90px;
            min-width: 0px;
        }

        &:not(.fill) {
            border-radius: $radius;
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
