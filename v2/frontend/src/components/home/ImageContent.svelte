<svelte:options immutable={true} />

<script lang="ts">
    import type { ImageContent } from "../../domain/chat/chat";
    import Caption from "./Caption.svelte";

    export let content: ImageContent;
    export let fill: boolean;
    let imgElement: HTMLImageElement;

    let landscape = content.height < content.width;
    let withCaption = content.caption !== undefined;
</script>

{#if content.blobUrl !== undefined}
    <img
        bind:this={imgElement}
        on:error={() => (imgElement.src = content.thumbnailData)}
        class:landscape
        class:fill
        class:withCaption
        src={content.blobUrl}
        alt={content.caption} />
{/if}

{#if content.caption !== undefined}
    <Caption caption={content.caption} />
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
    }
</style>
