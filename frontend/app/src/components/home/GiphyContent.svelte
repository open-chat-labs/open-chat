<script lang="ts">
    import { ui, type GiphyContent } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import { rtlStore } from "../../stores/rtl";
    import { lowBandwidth } from "../../stores/settings";
    import Button from "../Button.svelte";
    import Translatable from "../Translatable.svelte";
    import ContentCaption from "./ContentCaption.svelte";

    interface Props {
        content: GiphyContent;
        fill: boolean;
        draft?: boolean;
        reply?: boolean;
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
        height = undefined,
        intersecting = true,
        edited,
        blockLevelMarkdown = false,
    }: Props = $props();

    let withCaption = $derived(content.caption !== undefined && content.caption !== "");
    let image = $derived(ui.mobileWidth ? content.mobile : content.desktop);
    let landscape = $derived(image.height < image.width);
    let style = $derived(
        `${height === undefined ? "" : `height: ${height}px;`} max-width: ${image.width}px;`,
    );

    let hidden = $derived($lowBandwidth);
</script>

<div class="img-wrapper">
    {#if !intersecting}
        <div
            class="placeholder"
            class:landscape
            class:fill
            class:withCaption
            {style}
            class:draft
            title={content.caption ?? content.title}
            class:reply
            class:rtl={$rtlStore}>
        </div>
    {:else if ui.mobileWidth || hidden}
        {#if hidden && !ui.mobileWidth}
            <div class="mask">
                {#if !reply}
                    <div class="reveal">
                        <Button onClick={() => (hidden = false)}
                            ><Translatable resourceKey={i18nKey("loadGif")} /></Button>
                    </div>
                {/if}
            </div>
        {/if}
        <img
            class:landscape
            class:fill
            class:withCaption
            class:draft
            class:reply
            class:rtl={$rtlStore}
            {style}
            src={content.mobile.url}
            alt={content.caption ?? content.title} />
    {:else}
        <video
            autoplay
            muted
            loop
            playsinline
            class:landscape
            class:fill
            class:withCaption
            class:draft
            class:reply
            class:rtl={$rtlStore}
            title={content.caption ?? content.title}
            {style}>
            <track kind="captions" />
            <source src={content.desktop.url} type="video/mp4" />
        </video>
    {/if}
</div>

<ContentCaption caption={content.caption} {edited} {blockLevelMarkdown} />

<style lang="scss">
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

    .placeholder,
    img,
    video {
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
