<svelte:options immutable={true} />

<script lang="ts">
    import SvelteMarkdown from "svelte-markdown";
    import VideoContent from "./VideoContent.svelte";
    import ImageContent from "./ImageContent.svelte";
    import AudioContent from "./AudioContent.svelte";

    import FileContent from "./FileContent.svelte";
    import DeletedContent from "./DeletedContent.svelte";
    import type { MessageContent } from "../../domain/chat/chat";
    import { getContentAsText } from "../../domain/chat/chat.utils";

    const SIZE_LIMIT = 1000;
    export let content: MessageContent;
    export let me: boolean = false;
    export let truncate: boolean = false;

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
    <SvelteMarkdown source={truncate ? truncateTo(SIZE_LIMIT, textContent) : textContent} />
{:else if content.kind === "image_content"}
    <ImageContent {content} />
{:else if content.kind === "video_content"}
    <VideoContent {content} />
{:else if content.kind === "audio_content"}
    <AudioContent {content} />
{:else if content.kind === "file_content"}
    <FileContent {me} {content} />
{:else if content.kind === "deleted_content"}
    <DeletedContent />
{:else if content.kind === "cycles_content"}
    <div>Cycles content</div>
{/if}
