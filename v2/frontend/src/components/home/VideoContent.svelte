<svelte:options immutable={true} />

<script lang="ts">
    import { onDestroy } from "svelte";
    import { _ } from "svelte-i18n";
    import type { MediaContent } from "../../domain/chat/chat";

    export let content: MediaContent;

    let landscape = content.height < content.width;
    let style = landscape ? `width: ${content.width}px` : `height: ${content.height}px`;

    let videoPlayer: HTMLVideoElement;

    onDestroy(() => {
        content.url && URL.revokeObjectURL(content.url);
    });
</script>

<div class="video">
    <video
        bind:this={videoPlayer}
        preload="none"
        {style}
        poster={content.thumbnailData}
        class:landscape
        controls>
        <track kind="captions" />
        {#if content.url}
            <source src={content.url} />
        {/if}
    </video>
</div>

<style type="text/scss">
    .video {
        position: relative;
        cursor: pointer;

        video {
            max-width: none;
            width: auto;
            height: 100%;
            max-height: calc(var(--vh, 1vh) * 50);
            display: block;

            &.landscape {
                max-width: calc(var(--vh, 1vh) * 50);
                width: 100%;
                height: auto;
                max-height: none;
            }
        }
    }
</style>
