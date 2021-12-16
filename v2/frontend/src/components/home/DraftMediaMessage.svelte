<svelte:options immutable={true} />

<script lang="ts">
    import type { VideoContent as VideoContentType } from "../../domain/chat/chat";
    import type { ImageContent as ImageContentType } from "../../domain/chat/chat";
    import type { AudioContent as AudioContentType } from "../../domain/chat/chat";
    import VideoContent from "./VideoContent.svelte";
    import ImageContent from "./ImageContent.svelte";
    import AudioContent from "./AudioContent.svelte";

    export let content: VideoContentType | ImageContentType | AudioContentType;
</script>

<div class="msg-preview">
    {#if content.kind === "video_content"}
        <VideoContent fill={false} content={content} draft={true} />
    {:else if content.kind === "audio_content"}
        <AudioContent content={content} />
    {:else if content.kind === "image_content"}
        <ImageContent fill={false} content={content} draft={true} />
    {/if}
</div>

<style type="text/scss">
    .msg-preview {
        border-radius: $sp4 $sp4 0 0;
        min-width: 90px;
        margin-top: $sp4;
    }
</style>
