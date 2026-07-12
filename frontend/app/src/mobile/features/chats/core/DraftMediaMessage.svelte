<script lang="ts">
    import { Row } from "component-lib";
    import type { AttachmentContent } from "@client";
    import { currentUserIdStore } from "@client";
    import AudioContent from "@src/mobile/features/chats/core/content/AudioContent.svelte";
    import CryptoContent from "@src/mobile/features/chats/core/content/CryptoContent.svelte";
    import FileContent from "@src/mobile/features/chats/core/content/FileContent.svelte";
    import GiphyAttached from "./GiphyAttached.svelte";
    import ImageContent from "@src/mobile/features/chats/core/content/ImageContent.svelte";
    import P2PSwapContent from "@src/mobile/features/chats/core/content/P2PSwapContent.svelte";
    import PrizeContent from "@src/mobile/features/chats/core/content/PrizeContent.svelte";
    import VideoContent from "@src/mobile/features/chats/core/content/VideoContent.svelte";

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
        <AudioContent onRemove={onRemoveAttachment} {content} me draft edited={false} />
    {:else if content.kind === "image_content"}
        <ImageContent
            onRemove={onRemoveAttachment}
            {content}
            me
            draft
            edited={false}
            fill={false} />
    {:else if content.kind === "giphy_content"}
        <GiphyAttached onRemove={onRemoveAttachment} {content} />
    {:else if content.kind === "crypto_content"}
        <CryptoContent
            onRemove={onRemoveAttachment}
            {content}
            me
            draft
            senderId={$currentUserIdStore} />
    {:else if content.kind === "p2p_swap_content_initial"}
        <P2PSwapContent draft me onRemove={onRemoveAttachment} {content} />
    {:else if content.kind === "prize_content_initial"}
        <PrizeContent me draft onRemove={onRemoveAttachment} {content} />
    {:else if content.kind === "file_content"}
        <FileContent onRemove={onRemoveAttachment} edited={false} me {content} draft />
    {/if}
</Row>
