<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { VideoContent } from "../../domain/chat/chat";
    import Caption from "./Caption.svelte";

    export let content: VideoContent;
    export let fill: boolean;

    let withCaption = content.caption !== undefined;
</script>

<div class="video">
    <video
        preload="none"
        poster={content.imageData.blobUrl}
        class:fill
        class:withCaption
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
            width: 100%;
            height: 100%;
            display: block;

            &:not(.fill) {
                border-radius: $sp4;
            }

            &.withCaption {
                margin-bottom: $sp2;
            }
        }
    }
</style>
