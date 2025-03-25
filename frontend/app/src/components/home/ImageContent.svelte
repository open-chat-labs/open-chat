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

    interface Props {
        content: ImageContent | MemeFighterContent;
        fill: boolean;
        draft?: boolean;
        reply?: boolean;
        pinned?: boolean;
        height?: number | undefined;
        intersecting?: boolean;
        edited: boolean;
        blockLevelMarkdown?: boolean;
    }

    let {
        content,
        fill,
        draft = false,
        reply = false,
        pinned = false,
        height = undefined,
        intersecting = true,
        edited,
        blockLevelMarkdown = false,
    }: Props = $props();

    let imgElement: HTMLImageElement;
    let zoom = $state(false);
    let withCaption =
        content.kind === "image_content" && content.caption !== undefined && content.caption !== "";
    let landscape = content.height < content.width;
    let zoomedWidth: number = $state(0);
    let zoomedHeight: number = $state(0);

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

    function onDoubleClick(e: Event) {
        e.stopPropagation();
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
    let normalised = $derived(normaliseContent(content));
    let hidden = $state(false);
    $effect(() => {
        hidden = $lowBandwidth && !draft;
    });
    let zoomable = $derived(!draft && !reply && !pinned);
</script>

<svelte:window
    onresize={recalculateZoomedDimensions}
    onorientationchange={recalculateZoomedDimensions} />

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
            onclick={onClick}
            ondblclick={onDoubleClick}
            onerror={() => {
                if (imgElement) {
                    imgElement.src = normalised.fallback;
                }
            }}
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
            <div class="expand" class:rtl={$rtlStore} class:zoomed={zoom} onclick={toggleZoom}>
                <ArrowExpand size={"1em"} color={"#fff"} />
            </div>
        {/if}
    </div>
{/if}

<ContentCaption caption={normalised.caption} {edited} {blockLevelMarkdown} />

{#if zoomable && zoom}
    <Overlay onClose={() => (zoom = false)} dismissible alignBottomOnMobile={false}>
        <ModalContent hideHeader hideFooter fill fitToContent fixedWidth={false}>
            {#snippet body()}
                <span class="body">
                    <img
                        class="zoomed"
                        class:landscape
                        width={zoomedWidth}
                        height={zoomedHeight}
                        onclick={onClick}
                        ondblclick={onDoubleClick}
                        onerror={() => (imgElement.src = normalised.fallback)}
                        src={normalised.url}
                        alt={normalised.caption} />
                    <div
                        class="expand"
                        class:rtl={$rtlStore}
                        class:zoomed={zoom}
                        onclick={toggleZoom}>
                        <ArrowCollapse size={"1em"} color={"#fff"} />
                    </div>
                </span>
            {/snippet}
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
