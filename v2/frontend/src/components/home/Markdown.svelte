<svelte:options immutable={true} />

<script lang="ts">
    import SvelteMarkdown from "svelte-markdown";
    import ChatMessageLink from "./ChatMessageLink.svelte";
    import ChatMessageLinkSuppressed from "./ChatMessageLinkSuppressed.svelte";
    import { Boundary } from "@crownframework/svelte-error-boundary";
    import { rollbar } from "../../utils/logging";

    export let text: string;
    export let inline: boolean = true;
    export let oneLine: boolean = false;
    export let suppressLinks: boolean = false;

    function interceptError(err: Error): void {
        rollbar.error("Intercepted error at boundary: ", err);
    }
</script>

<p class="markdown-wrapper" class:inline class:oneLine>
    <Boundary onError={interceptError}>
        <SvelteMarkdown
            options={{ breaks: !oneLine, sanitize: true }}
            isInline={true}
            source={text}
            renderers={{ link: suppressLinks ? ChatMessageLinkSuppressed : ChatMessageLink }} />
    </Boundary>
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
