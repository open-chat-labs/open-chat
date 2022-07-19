<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import type { FileContent } from "../../domain/chat/chat";
    import format from "../../utils/fileSize";
    import ContentCaption from "./ContentCaption.svelte";
    import FileDownload from "svelte-material-icons/FileDownload.svelte";

    export let content: FileContent;
    export let me: boolean = false;
    export let reply: boolean = false;
    export let draft: boolean = false;
    export let edited: boolean;

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
        <div class="link-contents">
            <FileDownload size={"1.7em"} {color} />
            {content.name}
        </div>
    </a>

    <div class="meta-wrapper" class:caption={content.caption !== undefined}>
        {`${content.mimeType}-${format(content.fileSize)}`}
    </div>
{/if}

<ContentCaption caption={content.caption} {edited} {reply} />

<style type="text/scss">
    .file-content {
        height: 30px;
        display: block;
        cursor: pointer;
        @include ellipsis();
        margin-right: $sp2;

        &.rtl {
            margin-right: 0;
            margin-left: $sp2;
        }

        &:hover {
            text-decoration: underline;
        }
    }

    a {
        color: inherit;
    }

    .link-contents {
        display: flex;
        flex-direction: row;
        align-items: center;
    }

    :global(.link-contents > svg) {
        margin-right: $sp2;
    }

    :global(.link-contents.rtl > svg) {
        margin-right: 0;
        margin-left: $sp2;
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
