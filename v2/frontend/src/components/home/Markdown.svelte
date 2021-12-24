<svelte:options immutable={true} />

<script lang="ts">
    import SvelteMarkdown from "svelte-markdown";
    import ChatMessageLink from "./ChatMessageLink.svelte";

    export let text: string;
    export let inline: boolean = true;
</script>

<p class="markdown-wrapper" class:inline>
    <SvelteMarkdown
        options={{ breaks: true, sanitize: true }}
        isInline={true}
        source={text}
        renderers={{ link: ChatMessageLink }} />
</p>

<style type="text/scss">
    :global(.markdown-wrapper a) {
        text-decoration: underline;
        word-break: break-all;
    }

    .markdown-wrapper {
        word-wrap: break-word;
        &.inline {
            display: inline;
        }
    }

    .markdown-wrapper:not(:empty) {
        display: inline;

        &:not(.inline) {
            display: block;
        }
    }
</style>
