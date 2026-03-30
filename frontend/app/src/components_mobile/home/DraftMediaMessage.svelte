<script lang="ts">
    import { Row } from "component-lib";
    import type { AttachmentContent } from "openchat-client";
    import { currentUserIdStore } from "openchat-client";
    import AudioContent from "./AudioContent.svelte";
    import CryptoContent from "./CryptoContent.svelte";
    import FileContent from "./FileContent.svelte";
    import GiphyAttached from "./GiphyAttached.svelte";
    import ImageAttached from "./ImageAttached.svelte";
    import P2PSwapContentInitial from "./P2PSwapContentInitial.svelte";
    import PrizeContentInitial from "./PrizeContentInitial.svelte";
    import VideoContent from "./VideoContent.svelte";

    interface Props {
        content: AttachmentContent;
        onRemoveAttachment?: () => void;
    }

    let { content, onRemoveAttachment }: Props = $props();
</script>

<Row>
    {#if content.kind === "video_content"}
        <VideoContent
            onRemove={onRemoveAttachment}
            {content}
            me
            draft
            edited={false}
            fill={false} />
    {:else if content.kind === "audio_content"}
        <!-- Audio content does not have a separate "attached" version -->
        <AudioContent onRemove={onRemoveAttachment} {content} me draft edited={false} />
    {:else if content.kind === "image_content"}
        <ImageAttached onRemove={onRemoveAttachment} {content} fill={false} draft />
    {:else if content.kind === "giphy_content"}
        <GiphyAttached onRemove={onRemoveAttachment} {content} />
    {:else if content.kind === "crypto_content"}
        <CryptoContent
            onRemove={onRemoveAttachment}
            me
            {content}
            draft
            senderId={$currentUserIdStore} />
    {:else if content.kind === "p2p_swap_content_initial"}
        <P2PSwapContentInitial onRemove={onRemoveAttachment} {content} />
    {:else if content.kind === "prize_content_initial"}
        <PrizeContentInitial onRemove={onRemoveAttachment} {content} />
    {:else if content.kind === "file_content"}
        <!-- File content does not have a separate "attached" version -->
        <FileContent onRemove={onRemoveAttachment} edited={false} me {content} draft />
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
