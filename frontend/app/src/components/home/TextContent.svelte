<svelte:options immutable={false} />

<script lang="ts">
    import Markdown from "./Markdown.svelte";
    import IntersectionObserver from "./IntersectionObserver.svelte";
    import { _ } from "svelte-i18n";
    import type { TextContent } from "openchat-client";
    import ArrowExpand from "svelte-material-icons/ArrowExpand.svelte";
    import { lowBandwidth } from "../../stores/settings";
    import LinkPreview from "./LinkPreview.svelte";

    const SIZE_LIMIT = 1000;
    export let content: TextContent;
    export let truncate: boolean = false;
    export let pinned: boolean = false;
    export let edited: boolean;
    export let fill: boolean;

    $: expanded = !$lowBandwidth;

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

    $: text = truncateText(content.text);
    $: containsCodeBlock = content.text.match(/```([\s\S]*)```/);
    $: linkMatch = content.text.match(/(https?:\/\/[^\s\)]+)/g);
</script>

<Markdown inline={!containsCodeBlock} suppressLinks={pinned} {text} />
{#if edited}
    <span class="edited-msg">({$_("edited")})</span>
{/if}

{#if linkMatch}
    {#if !expanded}
        <span on:click={expand} class="expand" title={$_("showPreview")}>
            <ArrowExpand viewBox="0 -3 24 24" size={"1em"} color={"var(--txt)"} />
        </span>
    {:else}
        <IntersectionObserver let:intersecting>
            <LinkPreview {pinned} {fill} text={content.text} links={linkMatch} {intersecting} />
        </IntersectionObserver>
    {/if}
{/if}

<style lang="scss">
    .expand {
        cursor: pointer;
        padding: 0 $sp3;
    }
</style>
