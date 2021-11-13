<svelte:options immutable={true} />

<script lang="ts">
    import SvelteMarkdown from "svelte-markdown";
    import VideoContent from "./VideoContent.svelte";
    import ImageContent from "./ImageContent.svelte";
    import AudioContent from "./AudioContent.svelte";

    import FileContent from "./FileContent.svelte";
    import DeletedContent from "./DeletedContent.svelte";
    import PlaceholderContent from "./PlaceholderContent.svelte";
    import type { MessageContent } from "../../domain/chat/chat";
    import { getContentAsText } from "../../domain/chat/chat.utils";

    const SIZE_LIMIT = 1000;
    export let content: MessageContent;
    export let me: boolean = false;
    export let truncate: boolean = false;
    export let fill: boolean;

    $: textContent = getContentAsText(content);

    // todo - we might be able to do something nicer than this with pure css, but we just need to do
    // *something* to make sure there a limit to the size of this box
    function truncateTo(n: number, str: string): string {
        if (str.length > n) {
            return str.slice(0, n) + "...";
        }
        return str;
    }
</script>

{#if content.kind === "text_content"}
    <div class="text-content">
        <div class="text-wrapper">
            <slot />
            <SvelteMarkdown source={truncate ? truncateTo(SIZE_LIMIT, textContent) : textContent} />
        </div>
    </div>
{:else if content.kind === "image_content"}
    <ImageContent {fill} {content} />
{:else if content.kind === "video_content"}
    <VideoContent {fill} {content} />
{:else if content.kind === "audio_content"}
    <AudioContent {content} />
{:else if content.kind === "file_content"}
    <FileContent {me} {content} />
{:else if content.kind === "deleted_content"}
    <DeletedContent {content} />
{:else if content.kind === "crypto_content"}
    <div>Crypto content</div>
{:else if content.kind === "placeholder_content"}
    <PlaceholderContent />
{/if}

<style type="text/scss">
    :global(.text-wrapper > p) {
        display: inline;
    }

    .text-wrapper {
        width: 100%;
    }

    .text-content {
        display: flex;
    }
</style>
