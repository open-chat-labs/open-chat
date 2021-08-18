<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import type { FileContent } from "../../domain/chat/chat";
    import FileDownload from "svelte-material-icons/FileDownload.svelte";
    import { dataToBlobUrl } from "../../utils/blob";
    import { onDestroy } from "svelte";

    export let content: FileContent;
    export let me: boolean = false;

    let color = me ? "var(--currentChat-msg-me-txt)" : "var(--currentChat-msg-txt)";
    let blobUrl = content.blobData.then((data) =>
        data ? dataToBlobUrl(data, content.mimeType) : undefined
    );

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
