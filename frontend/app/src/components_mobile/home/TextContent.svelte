<script lang="ts">
    import { Body } from "component-lib";
    import type { OpenChat, TextContent } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import ArrowExpand from "svelte-material-icons/ArrowExpand.svelte";
    import { lowBandwidth, renderPreviews } from "../../stores/settings";
    import IntersectionObserver from "./IntersectionObserver.svelte";
    import LinkPreviews from "./LinkPreviews.svelte";
    import Markdown from "./Markdown.svelte";

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
        showPreviews: boolean;
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
        showPreviews,
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
    let previewUrls = $derived(showPreviews ? extractPreviewUrls(content.text) : []);
    let iconColour = $derived(me ? "var(--currentChat-msg-me-txt)" : "var(--currentChat-msg-txt)");
</script>

<Body>
    <Markdown inline={!blockLevelMarkdown} suppressLinks={pinned} {text} />
</Body>
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

        @include mobile() {
            padding: 0 $sp3;
            border-radius: var(--rd);
            background-color: rgba(226, 226, 226, 0.2);
        }
    }
</style>
