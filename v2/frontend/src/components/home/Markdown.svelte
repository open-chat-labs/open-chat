<svelte:options immutable={true} />

<script lang="ts">
    import {encode} from 'html-entities';
    import { replaceNewlinesWithBrTags, wrapURLsInAnchorTags } from "../../utils/markup";

    export let text: string;
    export let inline: boolean = true;
    export let oneLine: boolean = false;
    export let suppressLinks: boolean = false;

    function renderTextContent(text: string): string {
        let str = text;

        // HTML encode the text
        str = encode(str);

        if (!oneLine) {
            str = replaceNewlinesWithBrTags(str);
        }

        if (!suppressLinks) {
            str = wrapURLsInAnchorTags(str, true);
        }

        return str;
    }    
</script>

<p class="markdown-wrapper" class:inline class:oneLine>
    {@html renderTextContent(text)}
</p>

<style type="text/scss">
    :global(.markdown-wrapper a) {
        text-decoration: underline;
        word-break: break-all;
    }

    .markdown-wrapper {
        word-wrap: break-word;
    }

    .markdown-wrapper:not(:empty) {
        display: inline;

        &:not(.inline) {
            display: block;
        }

        &.oneLine {
            display: block;
            @include ellipsis();
        }
    }
</style>
