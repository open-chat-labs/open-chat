<svelte:options immutable={true} />

<script lang="ts">
    import { onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import type { VideoContent } from "../../domain/chat/chat";
    import { calculateHeight } from "../../utils/layout";
    import Caption from "./Caption.svelte";

    export let content: VideoContent;
    export let fill: boolean;

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

<div class="video">
    <video
        preload="none"
        style={`height: ${height}px`}
        poster={content.imageData.blobUrl}
        class:landscape
        class:fill
        controls>
        <track kind="captions" />
        {#if content.videoData.blobUrl}
            <source src={content.videoData.blobUrl} />
        {/if}
    </video>
</div>

{#if content.caption !== undefined}
    <Caption caption={content.caption} />
{/if}

<style type="text/scss">
    .video {
        position: relative;
        cursor: pointer;

        video {
            max-width: none;
            width: auto;
            display: block;

            &:not(.fill) {
                border-radius: $sp4;
            }

            &.landscape {
                max-width: calc(var(--vh, 1vh) * 50);
                width: 100%;
            }
        }
    }
</style>
