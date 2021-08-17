<svelte:options immutable={true} />

<script lang="ts">
    import SvelteMarkdown from "svelte-markdown";
    import MediaContent from "./MediaContent.svelte";
    import type { DraftMessageContent, MessageContent } from "../../domain/chat/chat";
    import { getContentAsText } from "../../domain/chat/chat.utils";

    export let content: MessageContent | DraftMessageContent;

    $: textContent = getContentAsText(content);
</script>

{#if content.kind === "text_content"}
    <SvelteMarkdown source={textContent} />
{:else if content.kind === "media_content"}
    <MediaContent {content} />
{:else if content.kind === "file_content"}
    <div>File content</div>
{:else if content.kind === "cycles_content"}
    <div>Cycles content</div>
{/if}
