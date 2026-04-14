<script lang="ts">
    import { type GiphyContent, type TextContent as TextContentType } from "openchat-client";
    import { rtlStore } from "../../stores/rtl";
    import TextContent from "./TextContent.svelte";

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
        height = undefined,
        intersecting = true,
        edited,
        blockLevelMarkdown = false,
        isPreview = false,
    }: Props = $props();

    const MIN_GIF_WIDTH = 250;

    let withCaption = $derived(!!content.caption);
    let image = $derived(content.mobile);
    let landscape = $derived(image.height < image.width);
    let videoWidth = $derived(image.width < MIN_GIF_WIDTH ? MIN_GIF_WIDTH : image.width);
    let textContent = $derived<TextContentType | undefined>(
        withCaption ? { kind: "text_content", text: content.caption ?? "" } : undefined,
    );
    let style = $derived(
        `${height === undefined ? "" : `height: ${height}px;`} max-width: ${image.width}px;`,
    );
</script>

<div class="gif_content_wrapper" class:me class:fill class:rtl={$rtlStore}>
    {#if !intersecting}
        <div
            class="placeholder"
            class:landscape
            class:fill
            {style}
            class:withCaption
            title={content.caption ?? content.title}
            class:reply
            class:rtl={$rtlStore}>
        </div>
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
    <div class="attribution">
        <img src="/assets/klipy_logo.svg" alt="Powered by KLIPY" />
    </div>
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

        .attribution {
            position: absolute;
            bottom: 0;
            left: 0;

            img {
                width: 4rem;
            }
        }
    }

    .placeholder,
    img.gif,
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
