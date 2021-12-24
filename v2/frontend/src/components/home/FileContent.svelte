<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import type { FileContent } from "../../domain/chat/chat";
    import FileDownload from "svelte-material-icons/FileDownload.svelte";
    import Markdown from "./Markdown.svelte";

    export let content: FileContent;
    export let me: boolean = false;
    export let reply: boolean = false;
    export let draft: boolean = false;

    let color = me ? "var(--currentChat-msg-me-txt)" : "var(--currentChat-msg-txt)";
</script>

{#if content.blobUrl}
    <a
        href={content.blobUrl}
        title={$_("downloadFile", { values: { name: content.name } })}
        download={content.name}
        role="button"
        target="_blank"
        class:rtl={$rtlStore}
        class:draft
        class="file-content">
        <span class="icon">
            <FileDownload size={"1.7em"} {color} />
        </span>
        {content.name}
    </a>

    <div class="meta-wrapper" class:caption={content.caption !== undefined}>
        {`${content.mimeType}-${(content.fileSize / 1000).toFixed(2)}kb`}
    </div>
{/if}

{#if content.caption !== undefined}
    <Markdown text={content.caption} inline={!reply} />
{/if}

<style type="text/scss">
    .file-content {
        height: 30px;
        display: block;
        cursor: pointer;
        @include ellipsis();
        margin-right: $sp1;

        &.rtl {
            margin-right: 0;
            margin-left: $sp1;
        }
    }

    .icon {
        vertical-align: top;
    }

    .meta-wrapper {
        &.caption {
            margin-bottom: 4px;
        }

        &:not(.caption) {
            display: inline-block;
        }
        
        align-items: center;
        @include font(light, normal, fs-60);
        @include ellipsis();
    }
</style>
