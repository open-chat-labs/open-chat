<svelte:options immutable={true} />

<script lang="ts">
    import type { MediaContent } from "../../domain/chat/chat";
    import VideoContent from "./VideoContent.svelte";
    import ImageContent from "./ImageContent.svelte";
    import AudioContent from "./AudioContent.svelte";

    export let content: MediaContent;
</script>

{#if /^video/.test(content.mimeType)}
    <VideoContent {content} />
{/if}

{#if /^image/.test(content.mimeType)}
    <ImageContent {content} />
{/if}

{#if /^audio/.test(content.mimeType)}
    <AudioContent {content} />
{/if}

{#if content.caption !== undefined}
    <p>{content.caption}</p>
{/if}
