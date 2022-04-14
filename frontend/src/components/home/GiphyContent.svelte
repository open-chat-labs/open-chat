<svelte:options immutable={true} />

<script lang="ts">
    import { rtlStore } from "../../stores/rtl";
    import type { GiphyContent } from "../../domain/chat/chat";
    import Markdown from "./Markdown.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";

    export let content: GiphyContent;
    export let fill: boolean;
    export let draft: boolean = false;
    export let reply: boolean = false;
    export let height: number | undefined = undefined;
    export let intersecting: boolean = true;

    let withCaption = content.caption !== undefined && content.caption !== "";
    let image = $mobileWidth ? content.mobile : content.desktop;
    let landscape = image.height < image.width;
</script>

<div class="img-wrapper">
    {#if !intersecting}
        <div
            class="placeholder"
            class:landscape
            class:fill
            class:withCaption
            style={height === undefined ? undefined : `height: ${height}px`}
            class:draft
            title={content.caption ?? content.title}
            class:reply
            class:rtl={$rtlStore} />
    {:else if $mobileWidth}
        <img
            class:landscape
            class:fill
            class:withCaption
            class:draft
            class:reply
            class:rtl={$rtlStore}
            style={height === undefined ? undefined : `height: ${height}px`}
            src={content.mobile.url}
            alt={content.caption ?? content.title} />
    {:else}
        <video
            autoplay={true}
            muted={true}
            loop={true}
            playsinline={true}
            class:landscape
            class:fill
            class:withCaption
            class:draft
            class:reply
            class:rtl={$rtlStore}
            title={content.caption ?? content.title}
            style={height === undefined ? undefined : `height: ${height}px`}>
            <track kind="captions" />
            <source src={content.desktop.url} type="video/mp4" />
        </video>
    {/if}
</div>

{#if content.caption !== undefined}
    <Markdown text={content.caption} inline={!reply} />
{/if}

<style type="text/scss">
    .img-wrapper {
        position: relative;
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
