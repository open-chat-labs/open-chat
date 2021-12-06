<svelte:options immutable={true} />

<script lang="ts">
    import type { ImageContent } from "../../domain/chat/chat";
    import Caption from "./Caption.svelte";

    export let content: ImageContent;
    export let fill: boolean;
    export let draft: boolean = false;
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
        class:draft
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
    }
</style>
