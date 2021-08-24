<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import type { FileContent } from "../../domain/chat/chat";
    import FileDownload from "svelte-material-icons/FileDownload.svelte";
    import { dataToBlobUrl } from "../../utils/blob";
    import { afterUpdate, onDestroy } from "svelte";
    import { DataClient } from "../../services/data/data.client";

    export let content: FileContent;
    export let me: boolean = false;
    let downloaded: boolean = false;
    let anchor: HTMLAnchorElement;

    let color = me ? "var(--currentChat-msg-me-txt)" : "var(--currentChat-msg-txt)";
    $: blobUrl =
        content.blobData &&
        content.blobData.then((data) => (data ? dataToBlobUrl(data, content.mimeType) : undefined));

    afterUpdate(() => {
        if (downloaded && anchor) {
            anchor.click();
        }
    });

    function download() {
        if (content.blobReference) {
            // we need to overwrite the whole content object so that we trigger a re-render
            content = {
                ...content,
                blobData: DataClient.create(content.blobReference.canisterId)
                    .getData(content.blobReference)
                    .then((data) => {
                        downloaded = true;
                        return data;
                    }),
            };
        }
    }

    onDestroy(() => {
        blobUrl && blobUrl.then((url) => (url ? URL.revokeObjectURL(url) : undefined));
    });
</script>

{#await blobUrl then url}
    {#if url}
        <a
            href={url}
            title={$_("downloadFile", { values: { name: content.name } })}
            download={content.name}
            bind:this={anchor}
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
        cursor: pointer;
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
