<script lang="ts">
    import { Row } from "component-lib";
    import type { AttachmentContent, MessageContext } from "openchat-client";
    import { currentUserIdStore } from "openchat-client";
    import AudioContent from "./AudioContent.svelte";
    import CryptoContent from "./CryptoContent.svelte";
    import FileContent from "./FileContent.svelte";
    import GiphyContent from "./GiphyContent.svelte";
    import ImageContent from "./ImageContent.svelte";
    import P2PSwapContentInitial from "./P2PSwapContentInitial.svelte";
    import VideoContent from "./VideoContent.svelte";

    interface Props {
        content: AttachmentContent;
        ctx: MessageContext;
    }

    let { content, ctx }: Props = $props();
</script>

<Row>
    {#if content.kind === "video_content"}
        <VideoContent edited={false} fill={false} {content} draft />
    {:else if content.kind === "audio_content"}
        <AudioContent edited={false} {content} />
    {:else if content.kind === "image_content"}
        <ImageContent edited={false} fill={false} {content} draft />
    {:else if content.kind === "giphy_content"}
        <GiphyContent {ctx} edited={false} fill={false} {content} draft />
    {:else if content.kind === "crypto_content"}
        <CryptoContent me {ctx} {content} draft senderId={$currentUserIdStore} />
    {:else if content.kind === "p2p_swap_content_initial"}
        <P2PSwapContentInitial me {ctx} {content} draft senderId={$currentUserIdStore} />
    {:else if content.kind === "file_content"}
        <div class="file-preview">
            <FileContent edited={false} me {content} draft />
        </div>
    {/if}
</Row>

<style lang="scss">
    .file-preview {
        border-radius: $sp4;
        padding: $sp3;
        color: var(--currentChat-msg-me-txt);
        background-color: var(--currentChat-msg-me-bg);
    }
</style>
