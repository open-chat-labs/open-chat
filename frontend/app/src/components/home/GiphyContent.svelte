<svelte:options immutable={true} />

<script lang="ts">
    import { rtlStore } from "../../stores/rtl";
    import type { GiphyContent } from "openchat-client";
    import ContentCaption from "./ContentCaption.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import Button from "../Button.svelte";
    import { _ } from "svelte-i18n";
    import { lowBandwidth } from "../../stores/settings";

    export let content: GiphyContent;
    export let fill: boolean;
    export let draft: boolean = false;
    export let reply: boolean = false;
    export let height: number | undefined = undefined;
    export let intersecting: boolean = true;
    export let edited: boolean;

    $: withCaption = content.caption !== undefined && content.caption !== "";
    $: image = $mobileWidth ? content.mobile : content.desktop;
    $: landscape = image.height < image.width;
    $: style = `${height === undefined ? "" : `height: ${height}px;`} max-width: ${image.width}px;`;

    $: hidden = $lowBandwidth;
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
            class:rtl={$rtlStore} />
    {:else if $mobileWidth || hidden}
        {#if hidden && !$mobileWidth}
            <div class="mask">
                {#if !reply}
                    <div class="reveal">
                        <Button on:click={() => (hidden = false)}>{$_("loadGif")}</Button>
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
            {style}>
            <track kind="captions" />
            <source src={content.desktop.url} type="video/mp4" />
        </video>
    {/if}
</div>

<ContentCaption caption={content.caption} {edited} {reply} />

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
