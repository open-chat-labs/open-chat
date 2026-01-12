<script lang="ts">
    import type { ImageContent, MemeFighterContent } from "openchat-client";
    import ArrowExpand from "svelte-material-icons/ArrowExpand.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { rtlStore } from "../../stores/rtl";
    import { lowBandwidth } from "../../stores/settings";
    import { isTouchDevice } from "../../utils/devices";
    import Button from "../Button.svelte";
    import Translatable from "../Translatable.svelte";
    import ContentCaption from "./ContentCaption.svelte";
    import ZoomedImage from "./ZoomedImage.svelte";

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

    let imgElement: HTMLImageElement | undefined = $state();
    let zoom = $state(false);
    let landscape = $derived(content.height < content.width);

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
    }

    let normalised = $derived(normaliseContent(content));
    let hidden = $state(false);
    $effect(() => {
        hidden = $lowBandwidth && !draft;
    });
    let zoomable = $derived(!draft && !reply && !pinned);

    function onError() {
        if (imgElement) {
            imgElement.src = normalised.fallback;
        }
    }
</script>

{#if normalised.url !== undefined}
    <div class="img-wrapper">
        {#if hidden}
            <div class="mask">
                {#if !reply && !draft}
                    <div class="reveal">
                        <Button onClick={() => (hidden = false)}
                            ><Translatable resourceKey={i18nKey(normalised.loadMsg)} /></Button>
                    </div>
                {/if}
            </div>
        {/if}
        <img
            bind:this={imgElement}
            onclick={onClick}
            ondblclick={onDoubleClick}
            onerror={onError}
            class="unzoomed"
            class:landscape
            class:fill
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

{#if zoomable && zoom && normalised.url !== undefined}
    <ZoomedImage onClose={toggleZoom} url={normalised.url} />
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
