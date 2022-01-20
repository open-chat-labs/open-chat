<svelte:options immutable={true} />

<script lang="ts">
    import { wrapURLsInAnchorTags } from "../../utils/markup";
    import { marked } from "marked";
    import DOMPurify from "dompurify";
    import { onMount } from "svelte";
    import { rollbar } from "../../utils/logging";

    export let text: string;
    export let inline: boolean = true;
    export let oneLine: boolean = false;
    export let suppressLinks: boolean = false;

    let sanitized = "unsafe";
    const options = {
        breaks: !oneLine,
    };

    onMount(() => {
        let parsed = text;
        try {
            parsed = marked.parseInline(renderTextContent(text), options);
        } catch (err: any) {
            rollbar.error("Error parsing markdown: ", err);
        }

        try {
            sanitized = DOMPurify.sanitize(
                parsed,
                suppressLinks ? { FORBID_ATTR: ["href"] } : { ALLOWED_ATTR: ["target", "href"] }
            );
        } catch (err: any) {
            rollbar.error("Error sanitzing message content: ", err);
        }
    });

    // TODO - we shouldn't need this, we should be able to do it with a custom renderer, but I want to
    // come back to that.
    // this will not do exactly what we want for markdown links e.g. [a link](https://www.google.co.uk)
    function renderTextContent(text: string): string {
        let str = text;
        if (!suppressLinks) {
            str = wrapURLsInAnchorTags(str, true);
        }
        return str;
    }
</script>

<p class="markdown-wrapper" class:inline class:oneLine>
    {@html sanitized}
</p>

<style type="text/scss">
    :global(.markdown-wrapper a) {
        text-decoration: underline;
        word-break: break-all;
    }

    :global(.markdown-wrapper code) {
        border: 1px solid rgba(0, 0, 0, 0.1);
        background-color: rgba(255, 255, 255, 0.1);
        padding: 0 $sp2;
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
