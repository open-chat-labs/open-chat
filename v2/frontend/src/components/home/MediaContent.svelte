<svelte:options immutable={true} />

<script lang="ts">
    import { onDestroy } from "svelte";

    import type { MediaContent } from "../../domain/chat/chat";
    import { dataToBlobUrl } from "../../utils/blob";

    export let content: MediaContent;

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

    $: blobUrl = content.blobData.then((data) =>
        data ? dataToBlobUrl(data, content.mimeType) : undefined
    );

    onDestroy(() => {
        console.log("destroying image url");
        blobUrl.then((url) => (url ? URL.revokeObjectURL(url) : undefined));
    });
</script>

{#if isImage}
    {#await blobUrl}
        <pre>Waiting for an image</pre>
    {:then url}
        {#if url}
            <img src={url} alt={content.caption} />
        {/if}
    {/await}
{:else if isVideo}
    <div>Video content</div>
{/if}

<style type="text/scss">
    img {
        width: 100%;
    }
</style>
