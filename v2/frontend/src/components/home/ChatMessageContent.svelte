<svelte:options immutable={true} />

<script lang="ts">
    import {encode} from 'html-entities';
    // import SvelteMarkdown from "svelte-markdown";
    import VideoContent from "./VideoContent.svelte";
    import ImageContent from "./ImageContent.svelte";
    import AudioContent from "./AudioContent.svelte";
    // import ChatMessageLink from "./ChatMessageLink.svelte";

    import FileContent from "./FileContent.svelte";
    import DeletedContent from "./DeletedContent.svelte";
    import PlaceholderContent from "./PlaceholderContent.svelte";
    import type { MessageContent } from "../../domain/chat/chat";
    import { getContentAsText } from "../../domain/chat/chat.utils";
    import { replaceNewlinesWithBrTags, wrapURLsInAnchorTags } from "../../utils/markup";

    const SIZE_LIMIT = 1000;
    export let content: MessageContent;
    export let me: boolean = false;
    export let truncate: boolean = false;
    export let fill: boolean;
    export let reply: boolean = false;
    export let height: number | undefined = undefined;

    $: textContent = getContentAsText(content);

    // const overriddenRenderers = {
    //     link: ChatMessageLink,
    // }

    function renderTextContent(): string {
        let str = textContent;

        // todo - we might be able to do something nicer than this with pure css, but we just need to do
        // *something* to make sure there a limit to the size of this box
        if (truncate && str.length > SIZE_LIMIT) {
            str = str.slice(0, SIZE_LIMIT) + "...";
        }

        // HTML encode the text
        str = encode(str);

        // Try to wrap links in <a> tags
        str = wrapURLsInAnchorTags(str, true);

        // Replace newlines with <br> tags
        return replaceNewlinesWithBrTags(str);
    }
</script>

{#if content.kind === "text_content"}
    <div class="text-content">
        <div class="text-wrapper">
            <slot />
            <p>{@html renderTextContent()}</p>
            <!-- <SvelteMarkdown 
                source={truncate ? truncateTo(SIZE_LIMIT, textContent) : textContent} 
                renderers={overriddenRenderers}
                options={{gfm: true, breaks: true}} /> -->
        </div>
    </div>
{:else if content.kind === "image_content"}
    <ImageContent {fill} {content} {reply} {height} />
{:else if content.kind === "video_content"}
    <VideoContent {fill} {content} {reply} {height} />
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
        word-wrap: break-word;
    }

    :global(.text-wrapper > p > a) {
        text-decoration: underline;
        word-break: break-all;
    }

    .text-wrapper {
        width: 100%;
    }

    .text-content {
        display: flex;
    }
</style>
