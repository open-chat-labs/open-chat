<svelte:options immutable={true} />

<script lang="ts">
    import Markdown from "./Markdown.svelte";
    import VideoContent from "./VideoContent.svelte";
    import ImageContent from "./ImageContent.svelte";
    import GiphyContent from "./GiphyContent.svelte";
    import AudioContent from "./AudioContent.svelte";
    import PollContent from "./PollContent.svelte";
    import FileContent from "./FileContent.svelte";
    import CryptoContent from "./CryptoContent.svelte";
    import DeletedContent from "./DeletedContent.svelte";
    import PlaceholderContent from "./PlaceholderContent.svelte";
    import type { MessageContent } from "../../domain/chat/chat";
    import { _ } from "svelte-i18n";

    const SIZE_LIMIT = 1000;
    export let content: MessageContent;
    export let me: boolean = false;
    export let truncate: boolean = false;
    export let fill: boolean;
    export let first: boolean;
    export let reply: boolean = false;
    export let pinned: boolean = false;
    export let height: number | undefined = undefined;
    export let preview: boolean;
    export let groupChat: boolean;
    export let senderId: string;

    function truncateText(text: string): string {
        // todo - we might be able to do something nicer than this with pure css, but we just need to do
        // *something* to make sure there a limit to the size of this box
        if (truncate && text.length > SIZE_LIMIT) {
            text = text.slice(0, SIZE_LIMIT) + "...";
        }

        return text;
    }
</script>

{#if content.kind === "text_content"}
    <Markdown suppressLinks={pinned} text={truncateText(content.text)} />
{:else if content.kind === "image_content"}
    <ImageContent {fill} {content} {reply} {pinned} {height} />
{:else if content.kind === "video_content"}
    <VideoContent {fill} {content} {reply} {height} />
{:else if content.kind === "audio_content"}
    <AudioContent {content} />
{:else if content.kind === "file_content"}
    <FileContent {me} {content} {reply} />
{:else if content.kind === "deleted_content"}
    <DeletedContent {content} />
{:else if content.kind === "crypto_content"}
    <CryptoContent {senderId} {content} {me} {first} {groupChat} />
{:else if content.kind === "placeholder_content"}
    <PlaceholderContent />
{:else if content.kind === "poll_content"}
    <PollContent {preview} {me} {content} on:registerVote />
{:else if content.kind === "giphy_content"}
    <GiphyContent {fill} {content} {reply} {height} />
{/if}
