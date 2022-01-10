<svelte:options immutable={true} />

<script lang="ts">
    import SvelteMarkdown from "svelte-markdown";
    import ChatMessageLink from "./ChatMessageLink.svelte";
    import ChatMessageLinkSuppressed from "./ChatMessageLinkSuppressed.svelte";

    export let text: string;
    export let inline: boolean = true;
    export let oneLine: boolean = false;
    export let suppressLinks: boolean = false;
</script>

<p class="markdown-wrapper" class:inline class:oneLine>
    <SvelteMarkdown
        options={{ breaks: !oneLine, sanitize: true }}
        isInline={true}
        source={text}
        renderers={{ link: suppressLinks ? ChatMessageLinkSuppressed : ChatMessageLink }} />
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
