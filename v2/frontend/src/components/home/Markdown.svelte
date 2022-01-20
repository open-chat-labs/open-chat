<svelte:options immutable={true} />

<script lang="ts">
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

    const renderer = {
        link(href: string | null, title: string | null, text: string) {
            if (suppressLinks) {
                return `<span class="fake-link" ${title && `title=${title}`}>${text}</span`;
            } else {
                return `<a href=${href} ${title && `title=${title}`} target="_blank">${text}</a>`;
            }
        },
    };

    marked.use({ renderer });

    onMount(() => {
        let parsed = text;
        try {
            parsed = marked.parseInline(text, options);
        } catch (err: any) {
            rollbar.error("Error parsing markdown: ", err);
        }

        try {
            sanitized = DOMPurify.sanitize(parsed, { ALLOWED_ATTR: ["target", "href", "class"] });
        } catch (err: any) {
            rollbar.error("Error sanitzing message content: ", err);
        }
    });
</script>

<p class="markdown-wrapper" class:inline class:oneLine>
    {@html sanitized}
</p>

<style type="text/scss">
    :global(.markdown-wrapper a) {
        text-decoration: underline;
        word-break: break-all;
    }

    :global(.markdown-wrapper .fake-link) {
        text-decoration: underline;
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
