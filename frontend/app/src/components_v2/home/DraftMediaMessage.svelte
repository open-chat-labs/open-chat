<script lang="ts">
    import type { AttachmentContent } from "openchat-client";
    import VideoContent from "./VideoContent.svelte";
    import ImageContent from "./ImageContent.svelte";
    import AudioContent from "./AudioContent.svelte";
    import FileContent from "./FileContent.svelte";

    interface Props {
        content: AttachmentContent;
    }

    let { content }: Props = $props();
</script>

<div class="msg-preview">
    {#if content.kind === "video_content"}
        <VideoContent edited={false} fill={false} {content} draft />
    {:else if content.kind === "audio_content"}
        <AudioContent me edited={false} {content} />
    {:else if content.kind === "image_content"}
        <ImageContent edited={false} fill={false} {content} draft />
    {:else if content.kind === "file_content"}
        <div class="file-preview">
            <FileContent edited={false} me {content} draft />
        </div>
    {/if}
</div>

<style lang="scss">
    .msg-preview {
        min-width: 90px;
        margin-top: $sp4;
    }

    .file-preview {
        border-radius: $sp4;
        padding: $sp3;
        color: var(--currentChat-msg-me-txt);
        background-color: var(--currentChat-msg-me-bg);
    }
</style>
