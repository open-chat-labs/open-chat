<svelte:options immutable={true} />

<script lang="ts">
    import type { MediaContent } from "../../domain/chat/chat";
    import VideoContent from "./VideoContent.svelte";
    import ImageContent from "./ImageContent.svelte";
    import AudioContent from "./AudioContent.svelte";
    import type { Identity } from "@dfinity/agent";

    export let content: MediaContent;
    export let identity: Identity;
</script>

{#if /^video/.test(content.mimeType)}
    <VideoContent {identity} {content} />
{/if}

{#if /^image/.test(content.mimeType)}
    <ImageContent {content} />
{/if}

{#if /^audio/.test(content.mimeType)}
    <AudioContent {identity} {content} />
{/if}

{#if content.caption !== undefined}
    <p>{content.caption}</p>
{/if}
