<script lang="ts">
    import Markdown from "./Markdown.svelte";
    import IntersectionObserver from "./IntersectionObserver.svelte";
    import { _ } from "svelte-i18n";
    import type { OpenChat, TextContent } from "openchat-client";
    import ArrowExpand from "svelte-material-icons/ArrowExpand.svelte";
    import { lowBandwidth, renderPreviews } from "../../stores/settings";
    import LinkPreviews from "./LinkPreviews.svelte";
    import { getContext } from "svelte";

    const SIZE_LIMIT = 1000;
    const client = getContext<OpenChat>("client");

    interface Props {
        content: TextContent;
        truncate?: boolean;
        pinned?: boolean;
        edited: boolean;
        fill: boolean;
        me: boolean;
        blockLevelMarkdown: boolean;
        onRemovePreview?: (url: string) => void;
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
    }: Props = $props();

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

    let expanded = $derived(!$lowBandwidth && $renderPreviews);
    let text = $derived(truncateText(content.text));
    let previewUrls = $derived(extractPreviewUrls(content.text));
    let iconColour = $derived(me ? "var(--currentChat-msg-me-txt)" : "var(--currentChat-msg-txt)");
</script>

<Markdown inline={!blockLevelMarkdown} suppressLinks={pinned} {text} />
{#if edited}
    <span class="edited-msg">({$_("edited")})</span>
{/if}

{#if previewUrls.length > 0}
    {#if !expanded}
        <span onclick={expand} class="expand" title={$_("showPreview")}>
            <ArrowExpand viewBox="0 -3 24 24" size={"1em"} color={iconColour} />
        </span>
    {:else}
        <IntersectionObserver unobserveOnIntersect={false}>
            {#snippet children(intersecting)}
                <LinkPreviews
                    {me}
                    {pinned}
                    {fill}
                    links={previewUrls}
                    {intersecting}
                    onRemove={onRemovePreview} />
            {/snippet}
        </IntersectionObserver>
    {/if}
{/if}

<style lang="scss">
    .expand {
        cursor: pointer;
    }
</style>
