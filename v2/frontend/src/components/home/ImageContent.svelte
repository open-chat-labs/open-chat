<svelte:options immutable={true} />

<script lang="ts">
    import { rtlStore } from "../../stores/rtl";
    import type { ImageContent } from "../../domain/chat/chat";
    import Caption from "./Caption.svelte";

    export let content: ImageContent;
    export let fill: boolean;
    export let draft: boolean = false;
    export let reply: boolean = false;
    export let height: number | undefined = undefined;

    let imgElement: HTMLImageElement;

    let withCaption = content.caption !== undefined && content.caption !== "";
    let landscape = content.height < content.width;
</script>

{#if content.blobUrl !== undefined}
    <img
        bind:this={imgElement}
        on:error={() => (imgElement.src = content.thumbnailData)}
        class:landscape
        class:fill
        class:withCaption
        class:draft
        class:reply
        class:rtl={$rtlStore}
        style={height === undefined ? undefined : `height: ${height}px`}
        src={content.blobUrl}
        alt={content.caption} />
{/if}

{#if content.caption !== undefined}
    <Caption caption={content.caption} reply={reply} />
{/if}

<style type="text/scss">
    img {
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
