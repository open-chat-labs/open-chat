<script lang="ts">
    import Markdown from "@src/ui/Markdown.svelte";
    import type { OgPreview, RehydratedMessagePreview, TextContent } from "@client";
    import { _ } from "svelte-i18n";
    import IntersectionObserver from "@src/desktop/features/chats/core/IntersectionObserver.svelte";
    import LinkPreviews from "@src/desktop/features/chats/core/LinkPreviews.svelte";

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
        messagePreviews?: RehydratedMessagePreview[];
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
        messagePreviews = [],
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
            {me}
            {pinned}
            {fill}
            {ogPreviews}
            {messagePreviews}
            {intersecting}
            onRemove={onRemovePreview} />
    {/snippet}
</IntersectionObserver>

<Markdown inline={!blockLevelMarkdown} suppressLinks={pinned} {text} />
{#if edited}
    <span class="edited-msg">({$_("edited")})</span>
{/if}
