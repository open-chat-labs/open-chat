<script lang="ts">
    import { ChatText, Column } from "component-lib";
    import type { OpenChat, TextContent } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import ArrowExpand from "svelte-material-icons/ArrowExpand.svelte";
    import { lowBandwidth, renderPreviews } from "../../stores/settings";
    import IntersectionObserver from "./IntersectionObserver.svelte";
    import LinkPreviews from "./LinkPreviews.svelte";
    import Markdown from "./Markdown.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        content: TextContent;
        me: boolean;
        fill: boolean;
        blockLevelMarkdown: boolean;
        showPreviews: boolean;
        edited: boolean;
        truncate?: boolean;
        pinned?: boolean;
        maxWidth?: number;
        onRemovePreview?: (url: string) => void;
    }

    let {
        content,
        me,
        fill,
        blockLevelMarkdown,
        showPreviews,
        edited,
        truncate = false,
        pinned = false,
        maxWidth,
        onRemovePreview,
    }: Props = $props();

    function extractPreviewUrls(text: string): string[] {
        const urls = client.extractEnabledLinks(text);
        return urls.length <= 5 ? urls : [];
    }

    function expand() {
        expanded = true;
    }

    let expanded = $derived(!$lowBandwidth && $renderPreviews);
    let text = $derived(content.text);
    let previewUrls = $derived(showPreviews ? extractPreviewUrls(content.text) : []);
    let iconColour = $derived(me ? "var(--currentChat-msg-me-txt)" : "var(--currentChat-msg-txt)");
</script>

{#if previewUrls.length > 0}
    {#if !expanded}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span onclick={expand} class="expand" title={$_("showPreview")}>
            <ArrowExpand viewBox="0 -3 24 24" size={"1em"} color={iconColour} />
        </span>
    {:else}
        <!-- TODO refine the top observer margin of 1000px -->
        <!-- on low bandwith, observer will trigger once the element is in veiw
             otherwise it will detect intersection at set margin -->
        <IntersectionObserver
            unobserveOnIntersect={false}
            rootMarginTop={$lowBandwidth ? 0 : 1000}
            rootMarginBottom={$lowBandwidth ? 0 : 1000}
            contextId="scrollable-messages-div">
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

<Column
    supplementalClass={`text_content ${truncate ? "truncated" : ""}`}
    padding={["xs", "sm"]}
    overflow={"hidden"}
    maxWidth={maxWidth ? `${maxWidth}px` : "auto"}>
    <div class="message_text">
        <ChatText width={"hug"} maxLines={truncate ? 3 : undefined}>
            <Markdown inline={!blockLevelMarkdown} suppressLinks={pinned} {text} />
        </ChatText>
        <span class="metadata_spacer" class:me class:edited></span>
    </div>
</Column>

<style lang="scss">
    .message_text {
        line-height: 0;
    }

    .expand {
        cursor: pointer;
        padding: 0 $sp3;
        border-radius: var(--rd);
        background-color: rgba(226, 226, 226, 0.2);
    }

    .metadata_spacer {
        display: inline-block;
        height: 1rem;

        &.me {
            width: 3.5rem;

            &.edited {
                width: 7rem;
            }
        }

        &:not(.me) {
            width: 2.5rem;

            &.edited {
                width: 6rem;
            }
        }
    }
</style>
