<script lang="ts">
    import { onDestroy } from "svelte";

    import type { MediaContent } from "../../domain/chat/chat";
    import { rtlStore } from "../../stores/rtl";
    import { dataToBlobUrl } from "../../utils/blob";

    export let draft: MediaContent;

    $: blobUrl = draft.blobData.then((data) =>
        data ? dataToBlobUrl(data, draft.mimeType) : undefined
    );

    onDestroy(() => {
        console.log("destroying image url");
        blobUrl.then((url) => (url ? URL.revokeObjectURL(url) : undefined));
    });

    let landscape = draft.height < draft.width;
</script>

<div class="msg-preview" class:rtl={$rtlStore}>
    {#await blobUrl}
        <div>TODO - Waiting for image to load</div>
    {:then url}
        <img class:landscape src={url} alt={draft.caption} />
    {/await}
</div>

<style type="text/scss">
    .msg-preview {
        border-radius: $sp4 $sp4 0 0;
        padding: $sp3;
        background-color: var(--section-bg);
        border-bottom: var(--section-bd);
        box-shadow: 0 -6px 10px 0 rgba(25, 25, 25, 0.25);
        border-left: 7px solid var(--button-bg);

        &.rtl {
            border-left: none;
            border-right: 7px solid var(--button-bg);
        }
    }

    img {
        max-width: none;
        width: auto;
        height: 100%;
        max-height: calc(var(--vh, 1vh) * 50);

        &.landscape {
            max-width: calc(var(--vh, 1vh) * 50);
            width: 100%;
            height: auto;
            max-height: none;
        }
    }
</style>
