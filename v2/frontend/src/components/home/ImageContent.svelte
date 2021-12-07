<svelte:options immutable={true} />

<script lang="ts">
    import { onMount } from "svelte";
    import type { ImageContent } from "../../domain/chat/chat";
    import { calculateHeight } from "../../utils/layout";
    import Caption from "./Caption.svelte";

    export let content: ImageContent;
    export let fill: boolean;
    export let draft: boolean = false;
    let imgElement: HTMLImageElement;

    let withCaption = content.caption !== undefined && content.caption !== "";
    let landscape = content.height < content.width;
    let height = 0;

    function recalculateHeight() {
        height = calculateHeight(
            document.getElementById("chat-messages")?.offsetWidth ?? 0,
            content
        );
    }
    onMount(recalculateHeight);
</script>

<svelte:window on:resize={recalculateHeight} />

{#if content.blobUrl !== undefined}
    <img
        bind:this={imgElement}
        on:error={() => (imgElement.src = content.thumbnailData)}
        class:landscape
        class:fill
        class:withCaption
        class:draft
        style={`height: ${height}px`}
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
