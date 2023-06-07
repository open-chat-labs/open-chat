<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import type { FileContent, OpenChat } from "openchat-client";
    import ContentCaption from "./ContentCaption.svelte";
    import FileDownload from "svelte-material-icons/FileDownload.svelte";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");

    export let content: FileContent;
    export let me: boolean = false;
    export let reply: boolean = false;
    export let draft: boolean = false;
    export let edited: boolean;

    let color = me ? "#ffffff" : "var(--txt)";
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
        {`${content.mimeType}-${client.formatFileSize(content.fileSize)}`}
    </div>
{/if}

<ContentCaption caption={content.caption} {edited} {reply} />

<style lang="scss">
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
