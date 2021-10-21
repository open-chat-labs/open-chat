<svelte:options immutable={true} />

<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import type { VideoContent } from "../../domain/chat/chat";
    import { calculateHeight } from "../../utils/layout";
    import Caption from "./Caption.svelte";

    export let content: VideoContent;

    let landscape = content.height < content.width;
    let videoPlayer: HTMLVideoElement;
    let height = 0;

    function recalculateHeight() {
        height = calculateHeight(
            document.getElementById("chat-messages")?.offsetWidth ?? 0,
            content
        );
    }

    onMount(recalculateHeight);

    onDestroy(() => {
        content.videoData.blobUrl && URL.revokeObjectURL(content.videoData.blobUrl);
        content.imageData.blobUrl && URL.revokeObjectURL(content.imageData.blobUrl);
    });
</script>

<svelte:window on:resize={recalculateHeight} />

<div class="video">
    <video
        bind:this={videoPlayer}
        preload="none"
        style={`height: ${height}px`}
        poster={content.imageData.blobUrl}
        class:landscape
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

            &.landscape {
                max-width: calc(var(--vh, 1vh) * 50);
                width: 100%;
            }
        }
    }
</style>
