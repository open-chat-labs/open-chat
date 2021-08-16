<svelte:options immutable={true} />

<script lang="ts">
    import type { MediaContent, DraftMediaContent } from "../../domain/chat/chat";

    export let content: MediaContent | DraftMediaContent;

    // the React version of this component has a hook that loads the media data on load
    // and then calls revokeObjectUrl on unload / destroy. We need to think about *when* to
    // load this data in svelte / xstate land. I think we should do this when we actually load the
    // data - i.e. we just rehydrate it when we load it.
    // This *could* cause use to spew a huge number of requests if we are not careful
    // But lets worry about that later. In any case we need a way to load the data for a media message.

    // would be much cleaner to deal with this on load so that a media content message and a draft media content
    // are essentially the same data structure. Would much prefer that.

    $: isImage = /^image/.test(content.mimeType);
    $: isVideo = /^video/.test(content.mimeType);
</script>

{#if isImage}
    {#if content.blobUrl !== undefined}
        <img src={content.blobUrl} alt={content.caption} />
    {/if}
{:else if isVideo}
    <div>Video content</div>
{/if}

<style type="text/scss">
    img {
        width: 100%;
    }
</style>
