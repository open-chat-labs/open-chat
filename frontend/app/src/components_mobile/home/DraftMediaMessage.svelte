<script lang="ts">
    import { Row } from "component-lib";
    import type { AttachmentContent, MessageContext } from "openchat-client";
    import { currentUserIdStore, localUpdates } from "openchat-client";
    import AudioContent from "./AudioContent.svelte";
    import CryptoContent from "./CryptoContent.svelte";
    import FileContent from "./FileContent.svelte";
    import GiphyAttached from "./GiphyAttached.svelte";
    import ImageAttached from "./ImageAttached.svelte";
    import P2PSwapContentInitial from "./P2PSwapContentInitial.svelte";
    import PrizeContentInitial from "./PrizeContentInitial.svelte";
    import VideoAttached from "./VideoAttached.svelte";

    interface Props {
        content: AttachmentContent;
        ctx: MessageContext;
    }

    let { content, ctx }: Props = $props();

    function removeDraft() {
        localUpdates.draftMessages.delete(ctx);
    }
</script>

<Row>
    {#if content.kind === "video_content"}
        <VideoAttached onRemove={removeDraft} {content} />
    {:else if content.kind === "audio_content"}
        <AudioContent me onRemove={removeDraft} edited={false} {content} draft />
    {:else if content.kind === "image_content"}
        <ImageAttached onRemove={removeDraft} fill={false} {content} draft />
    {:else if content.kind === "giphy_content"}
        <GiphyAttached onRemove={removeDraft} {content} />
    {:else if content.kind === "crypto_content"}
        <CryptoContent onRemove={removeDraft} me {content} draft senderId={$currentUserIdStore} />
    {:else if content.kind === "p2p_swap_content_initial"}
        <P2PSwapContentInitial onRemove={removeDraft} {content} />
    {:else if content.kind === "prize_content_initial"}
        <PrizeContentInitial onRemove={removeDraft} {content} />
    {:else if content.kind === "file_content"}
        <FileContent onRemove={removeDraft} edited={false} me {content} draft />
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
