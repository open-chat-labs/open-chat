<svelte:options immutable={false} />

<script lang="ts">
    import Markdown from "./Markdown.svelte";
    import IntersectionObserver from "./IntersectionObserver.svelte";
    import { _ } from "svelte-i18n";
    import type { OpenChat, TextContent } from "openchat-client";
    import ArrowExpand from "svelte-material-icons/ArrowExpand.svelte";
    import { lowBandwidth, renderPreviews } from "../../stores/settings";
    import LinkPreviews from "./LinkPreviews.svelte";
    import { createEventDispatcher, getContext } from "svelte";

    const SIZE_LIMIT = 1000;
    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");

    export let content: TextContent;
    export let truncate: boolean = false;
    export let pinned: boolean = false;
    export let edited: boolean;
    export let fill: boolean;
    export let me: boolean;
    export let blockLevelMarkdown: boolean;

    $: expanded = !$lowBandwidth && $renderPreviews;
    $: text = truncateText(content.text);
    $: previewUrls = extractPreviewUrls(content.text);

    function extractPreviewUrls(text: string): string[] {
        const urls = client.extractEnabledLinks(text);
        return urls.length <= 5 ? urls : [];
    }

    function truncateText(text: string): string {
        // todo - we might be able to do something nicer than this with pure css, but we just need to do
        // *something* to make sure there a limit to the size of this box
        if (truncate && text.length > SIZE_LIMIT) {
            text = text.slice(0, SIZE_LIMIT) + "...";
        }
        return text;
    }

    function expand() {
        expanded = true;
    }

    function removePreview(ev: CustomEvent<HTMLElement>) {
        dispatch("removePreview", ev.detail);
    }
</script>

<Markdown inline={!blockLevelMarkdown} suppressLinks={pinned} {text} />
{#if edited}
    <span class="edited-msg">({$_("edited")})</span>
{/if}

{#if previewUrls.length > 0}
    {#if !expanded}
        <span on:click={expand} class="expand" title={$_("showPreview")}>
            <ArrowExpand viewBox="0 -3 24 24" size={"1em"} color={"var(--txt)"} />
        </span>
    {:else}
        <IntersectionObserver unobserveOnIntersect={false} let:intersecting>
            <LinkPreviews
                {me}
                {pinned}
                {fill}
                links={previewUrls}
                {intersecting}
                on:remove={removePreview} />
        </IntersectionObserver>
    {/if}
{/if}

<style lang="scss">
    .expand {
        cursor: pointer;
    }
</style>
