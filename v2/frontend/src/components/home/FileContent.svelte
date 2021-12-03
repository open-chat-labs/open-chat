<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import type { FileContent } from "../../domain/chat/chat";
    import FileDownload from "svelte-material-icons/FileDownload.svelte";

    export let content: FileContent;
    export let me: boolean = false;

    let color = me ? "var(--currentChat-msg-me-txt)" : "var(--currentChat-msg-txt)";
</script>

{#if content.blobUrl}
    <a
        href={content.blobUrl}
        title={$_("downloadFile", { values: { name: content.name } })}
        download={content.name}
        role="button"
        target="_blank"
        class="file-content">
        <span class="icon" class:rtl={$rtlStore}>
            <FileDownload size={"1.7em"} {color} />
        </span>
        {content.name}
    </a>
{/if}

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
</style>
