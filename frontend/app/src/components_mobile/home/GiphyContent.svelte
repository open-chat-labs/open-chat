<script lang="ts">
    import { Button, ColourVars, Column } from "component-lib";
    import { type GiphyContent, type TextContent as TextContentType } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import { rtlStore } from "../../stores/rtl";
    import { lowBandwidth } from "../../stores/settings";
    import Translatable from "../Translatable.svelte";
    import TextContent from "./TextContent.svelte";
    import FileGifBox from "svelte-material-icons/FileGifBox.svelte";

    interface Props {
        content: GiphyContent;
        me: boolean;
        fill: boolean;
        reply?: boolean;
        height?: number | undefined;
        intersecting?: boolean;
        edited: boolean;
        blockLevelMarkdown?: boolean;
        isPreview?: boolean;
    }

    let {
        content,
        me,
        fill,
        reply = false,
        // height = undefined,
        intersecting = true,
        edited,
        blockLevelMarkdown = false,
        isPreview = false,
    }: Props = $props();

    const MIN_GIF_WIDTH = 200;

    let withCaption = $derived(!!content.caption);
    let image = $derived(content.mobile);
    let landscape = $derived(image.height < image.width);
    let videoWidth = $derived(image.width < MIN_GIF_WIDTH ? MIN_GIF_WIDTH : image.width);
    let textContent = $derived<TextContentType | undefined>(
        withCaption ? { kind: "text_content", text: content.caption ?? "" } : undefined,
    );
    let hidden = $derived($lowBandwidth);
    let style = $derived(`max-width: ${videoWidth}px`);
</script>

<div class="gif_content_wrapper" class:me class:fill class:rtl={$rtlStore}>
    {#if !intersecting}
        <div
            class="placeholder"
            class:landscape
            class:fill
            class:withCaption
            title={content.caption ?? content.title}
            class:reply
            class:rtl={$rtlStore}>
        </div>
    {:else if hidden}
        <Column
            height={"fill"}
            padding={"xl"}
            supplementalClass={"image_content_mask"}
            mainAxisAlignment={"center"}
            crossAxisAlignment={"center"}>
            {#if !reply}
                <Button height={"hug"} width={"fill"} onClick={() => (hidden = false)}
                    ><Translatable resourceKey={i18nKey("loadGif")} /></Button>
            {/if}
        </Column>
        <img
            class:landscape
            class:fill
            class:withCaption
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
            bind:clientWidth={videoWidth}
            class:landscape
            class:fill
            class:withCaption
            class:reply
            class:rtl={$rtlStore}
            {style}
            title={content.caption ?? content.title}>
            <track kind="captions" />
            <source src={content.desktop.url} type="video/mp4" />
        </video>
    {/if}
    <FileGifBox size="1.25rem" color={ColourVars.textPrimary} />
</div>

{#if textContent?.text}
    <TextContent
        content={textContent}
        {me}
        {fill}
        {blockLevelMarkdown}
        {edited}
        maxWidth={videoWidth}
        showPreviews={false}
        {isPreview} />
{/if}

<style lang="scss">
    :global {
        .gif_content_wrapper svg {
            opacity: 0.75;
            position: absolute;
            bottom: var(--sp-xxs);
            filter: drop-shadow(0 0 0.125rem var(--backdrop));
        }

        .gif_content_wrapper:not(.rtl) svg {
            left: var(--sp-xs);
        }

        .gif_content_wrapper.rtl svg {
            right: var(--sp-xs);
        }
    }

    .gif_content_wrapper {
        position: relative;
        overflow: hidden;

        // Border radiuses logic is same for image, gif, video and other media content!
        // TODO reuse the border radius logic, maybe a mixin?
        border-radius: var(--rad-lg) var(--rad-lg) var(--rad-md) var(--rad-md);

        &.me {
            border-top-right-radius: var(--rad-sm);
        }

        &:not(.me) {
            border-top-left-radius: var(--rad-sm);
        }

        &.fill {
            border-bottom-left-radius: var(--rad-lg);
            border-bottom-right-radius: var(--rad-lg);
        }
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
