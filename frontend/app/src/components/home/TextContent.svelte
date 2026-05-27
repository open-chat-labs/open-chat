<script lang="ts">
    import Markdown from "@shared_components/Markdown.svelte";
    import type { OgPreview, TextContent } from "openchat-client";
    import { _ } from "svelte-i18n";
    import IntersectionObserver from "./IntersectionObserver.svelte";
    import LinkPreviews from "./LinkPreviews.svelte";

    const SIZE_LIMIT = 1000;

    interface Props {
        content: TextContent;
        truncate?: boolean;
        pinned?: boolean;
        edited: boolean;
        fill: boolean;
        me: boolean;
        blockLevelMarkdown: boolean;
        onRemovePreview?: (url: string) => void;
        ogPreviews?: OgPreview[];
    }

    let {
        content,
        truncate = false,
        pinned = false,
        edited,
        fill,
        me,
        blockLevelMarkdown,
        onRemovePreview,
        ogPreviews = [],
    }: Props = $props();

    function truncateText(text: string): string {
        // todo - we might be able to do something nicer than this with pure css, but we just need to do
        // *something* to make sure there a limit to the size of this box
        if (truncate && text.length > SIZE_LIMIT) {
            text = text.slice(0, SIZE_LIMIT) + "...";
        }
        return text;
    }

    let text = $derived(truncateText(content.text));
</script>

<IntersectionObserver unobserveOnIntersect={false}>
    {#snippet children(intersecting)}
        <LinkPreviews
            text={content.text}
            {me}
            {pinned}
            {fill}
            {ogPreviews}
            {intersecting}
            onRemove={onRemovePreview} />
    {/snippet}
</IntersectionObserver>

<Markdown inline={!blockLevelMarkdown} suppressLinks={pinned} {text} />
{#if edited}
    <span class="edited-msg">({$_("edited")})</span>
{/if}
