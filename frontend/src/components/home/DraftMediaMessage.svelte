<svelte:options immutable={true} />

<script lang="ts">
    import type {
        CryptocurrencyContent as CryptoContentType,
        VideoContent as VideoContentType,
    } from "../../domain/chat/chat";
    import type { ImageContent as ImageContentType } from "../../domain/chat/chat";
    import type { AudioContent as AudioContentType } from "../../domain/chat/chat";
    import type { FileContent as FileContentType } from "../../domain/chat/chat";
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
        <VideoContent fill={false} {content} draft={true} />
    {:else if content.kind === "audio_content"}
        <AudioContent {content} />
    {:else if content.kind === "image_content"}
        <ImageContent fill={false} {content} draft={true} />
    {:else if content.kind === "file_content"}
        <div class="file-preview">
            <FileContent me={true} {content} draft={true} />
        </div>
    {/if}
</div>

<style type="text/scss">
    .msg-preview {
        min-width: 90px;
        margin-top: $sp4;
    }

    .file-preview {
        border-radius: $sp4;
        padding: $sp3;
        border: 1px solid var(--currentChat-msg-me-bd);
        color: var(--currentChat-msg-me-txt);
        background-color: var(--currentChat-msg-me-bg);
    }
</style>
