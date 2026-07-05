<script lang="ts">
    import Markdown from "@shared_components/Markdown.svelte";
    import { ChatCaption, ChatText, Column } from "component-lib";
    import type { OgPreview, RehydratedMessagePreview, TextContent } from "@client";
    import { type Snippet } from "svelte";
    import { lowBandwidth } from "../../stores/settings";
    import IntersectionObserver from "./IntersectionObserver.svelte";
    import LinkPreviews from "./LinkPreviews.svelte";

    interface Props {
        content: TextContent | Snippet;
        me: boolean;
        reply?: boolean;
        blockLevelMarkdown?: boolean;
        showPreviews?: boolean;
        edited?: boolean;
        truncate?: boolean;
        maxWidth?: number;
        // Indicates if the text content is rendered in context of a preview
        isPreview?: boolean;
        suppressLinks?: boolean;
        onRemovePreview?: (url: string) => void;
        ogPreviews?: OgPreview[];
        messagePreviews?: RehydratedMessagePreview[];
    }

    let {
        content,
        me,
        reply = false,
        blockLevelMarkdown = false,
        edited = false,
        truncate = false,
        maxWidth,
        isPreview = false,
        suppressLinks = false,
        onRemovePreview,
        ogPreviews = [],
        messagePreviews = [],
    }: Props = $props();

    let textContent = $derived<TextContent | undefined>("kind" in content ? content : undefined);
    let snippetContent = $derived<Snippet | undefined>("kind" in content ? undefined : content);

    let text = $derived(textContent?.text);
</script>

<IntersectionObserver
    unobserveOnIntersect={false}
    rootMarginTop={$lowBandwidth ? 0 : 1000}
    rootMarginBottom={$lowBandwidth ? 0 : 1000}
    contextId="scrollable-messages-div">
    {#snippet children(intersecting)}
        <LinkPreviews
            {me}
            {ogPreviews}
            {messagePreviews}
            {intersecting}
            onRemove={onRemovePreview} />
    {/snippet}
</IntersectionObserver>

<Column
    supplementalClass={`text_content ${truncate ? "truncated" : ""}`}
    padding={["xs", reply ? "zero" : "sm"]}
    overflow={"hidden"}
    maxWidth={maxWidth ? `${maxWidth}px` : "auto"}>
    <div class="message_text" class:me class:reply>
        {#if text}
            {#if isPreview}
                <ChatCaption
                    width={"hug"}
                    maxLines={truncate ? 3 : undefined}
                    colour={me ? "secondaryLight" : "primaryLight"}>
                    <Markdown inline={!blockLevelMarkdown} {suppressLinks} {text} />
                </ChatCaption>
            {:else}
                <ChatText width={"hug"} maxLines={truncate ? 3 : undefined}>
                    <Markdown inline={!blockLevelMarkdown} {suppressLinks} {text} />
                </ChatText>
                <span class="metadata_spacer" class:me class:edited></span>
            {/if}
        {:else if snippetContent}
            {@render snippetContent?.()}
            <span class="metadata_spacer" class:me class:edited></span>
        {/if}
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
            width: 3.25rem;

            &.edited {
                width: 6.5rem;
            }
        }

        &:not(.me) {
            width: 2.25rem;

            &.edited {
                width: 5.5rem;
            }
        }
    }
</style>
