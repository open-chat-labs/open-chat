<svelte:options immutable={true} />

<script lang="ts">
    import type {
        CryptocurrencyContent as CryptoContentType,
        VideoContent as VideoContentType,
        ImageContent as ImageContentType,
        AudioContent as AudioContentType,
        FileContent as FileContentType,
    } from "openchat-client";
    import VideoContent from "./VideoContent.svelte";
    import ImageContent from "./ImageContent.svelte";
    import AudioContent from "./AudioContent.svelte";
    import FileContent from "./FileContent.svelte";

    export let content:
        | VideoContentType
        | ImageContentType
        | AudioContentType
        | FileContentType
        | CryptoContentType;
</script>

<div class="msg-preview">
    {#if content.kind === "video_content"}
        <VideoContent edited={false} fill={false} {content} draft={true} />
    {:else if content.kind === "audio_content"}
        <AudioContent edited={false} {content} />
    {:else if content.kind === "image_content"}
        <ImageContent edited={false} fill={false} {content} draft={true} />
    {:else if content.kind === "file_content"}
        <div class="file-preview">
            <FileContent edited={false} me={true} {content} draft={true} />
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
