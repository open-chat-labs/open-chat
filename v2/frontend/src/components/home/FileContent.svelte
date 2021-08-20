<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    import { rtlStore } from "../../stores/rtl";
    import type { FileContent } from "../../domain/chat/chat";
    import FileDownload from "svelte-material-icons/FileDownload.svelte";
    import { dataToBlobUrl } from "../../utils/blob";
    import { onDestroy } from "svelte";
    const dispatch = createEventDispatcher();

    export let content: FileContent;
    export let me: boolean = false;

    let color = me ? "var(--currentChat-msg-me-txt)" : "var(--currentChat-msg-txt)";
    let blobUrl = content.blobData.then((data) =>
        data ? dataToBlobUrl(data, content.mimeType) : undefined
    );

    // to allow this to be lazy loaded means that the component is no longer immutable
    // so we need to be super carefull with that.
    function download() {
        dispatch("downloadData", content);
    }

    onDestroy(() => {
        console.log("destroying file url");
        blobUrl.then((url) => (url ? URL.revokeObjectURL(url) : undefined));
    });
</script>

{#await blobUrl then url}
    {#if url}
        <a
            href={url}
            title={$_("downloadFile", { values: { name: content.name } })}
            download={content.name}
            role="button"
            class="file-content">
            <span class="icon" class:rtl={$rtlStore}>
                <FileDownload size={"1.7em"} {color} />
            </span>
            <span class="name">
                {content.name}
            </span>
        </a>
    {:else}
        <div
            on:click={download}
            title={$_("downloadFile", { values: { name: content.name } })}
            class="file-content">
            <span class="icon" class:rtl={$rtlStore}>
                <FileDownload size={"1.7em"} {color} />
            </span>
            <span class="name">
                {content.name}
            </span>
        </div>
    {/if}
{/await}

<style type="text/scss">
    .file-content {
        display: block;
        @include ellipsis();
    }

    .icon {
        margin-right: $sp3;
        vertical-align: top;

        &.rtl {
            margin-right: 0;
            margin-left: $sp3;
        }
    }

    .name {
        @include font(bold, normal, fs-100);
    }
</style>
