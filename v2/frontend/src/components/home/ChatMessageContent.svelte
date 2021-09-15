<svelte:options immutable={true} />

<script lang="ts">
    import SvelteMarkdown from "svelte-markdown";
    import MediaContent from "./MediaContent.svelte";
    import FileContent from "./FileContent.svelte";
    import type { MessageContent } from "../../domain/chat/chat";
    import { getContentAsText } from "../../domain/chat/chat.utils";
    import type { Identity } from "@dfinity/agent";

    const SIZE_LIMIT = 1000;
    export let content: MessageContent;
    export let me: boolean = false;
    export let truncate: boolean = false;
    export let identity: Identity;

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
{:else if content.kind === "media_content"}
    <MediaContent {identity} {content} />
{:else if content.kind === "file_content"}
    <FileContent {identity} {me} {content} />
{:else if content.kind === "cycles_content"}
    <div>Cycles content</div>
{/if}
