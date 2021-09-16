<svelte:options immutable={true} />

<script lang="ts">
    import { rtlStore } from "../../stores/rtl";
    import type { VideoContent as VideoContentType } from "../../domain/chat/chat";
    import type { ImageContent as ImageContentType } from "../../domain/chat/chat";
    import type { AudioContent as AudioContentType } from "../../domain/chat/chat";
    import VideoContent from "./VideoContent.svelte";
    import ImageContent from "./ImageContent.svelte";
    import AudioContent from "./AudioContent.svelte";

    export let draft: VideoContentType | ImageContentType | AudioContentType;
</script>

<div class="msg-preview" class:rtl={$rtlStore}>
    {#if draft.kind === "video_content"}
        <VideoContent content={draft} />
    {:else if draft.kind === "audio_content"}
        <AudioContent content={draft} />
    {:else if draft.kind === "image_content"}
        <ImageContent content={draft} />
    {/if}
</div>

<style type="text/scss">
    .msg-preview {
        border-radius: $sp4 $sp4 0 0;
        padding: $sp3;
        background-color: var(--section-bg);
        border-bottom: var(--section-bd);
        box-shadow: 0 -6px 10px 0 rgba(25, 25, 25, 0.25);
        border-left: 7px solid var(--button-bg);

        &.rtl {
            border-left: none;
            border-right: 7px solid var(--button-bg);
        }
    }
</style>
