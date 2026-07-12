<script lang="ts">
    import { ChatCaption, Column, Label } from "component-lib";
    import { type OgPreview } from "@client";
    // import PreviewPlaceholder from "./PreviewPlaceholder.svelte";

    interface Props {
        me: boolean;
        ogPreview: OgPreview;
    }

    let { me, ogPreview }: Props = $props();

    let img = $derived(
        ogPreview.image && ogPreview.image.width > 0 && ogPreview.image.height > 0
            ? ogPreview.image
            : undefined,
    );

    let hostname = $derived.by(() => {
        try {
            return new URL(ogPreview.url).hostname.replace(/^www\./, "");
        } catch {
            return ogPreview.url;
        }
    });

    let safeUrl = $derived(isSafeUrl(ogPreview.url) ? ogPreview.url : undefined);

    function isSafeUrl(url: string): boolean {
        try {
            const parsed = new URL(url);
            return parsed.protocol === "http:" || parsed.protocol === "https:";
        } catch {
            return false;
        }
    }

    const textColour = $derived(me ? "primaryLight" : "textSecondary");
    const urlColour = $derived(me ? "textPrimary" : "secondary");
</script>

{#if ogPreview}
    <a href={safeUrl} target="_blank" rel="noopener noreferrer">
        <div class="generic-preview" class:me>
            {#if img}
                <img
                    style="aspect-ratio: {img.width} / {img.height}"
                    class="image"
                    loading="lazy"
                    src={img.url}
                    alt={ogPreview.title ?? ""} />
            {/if}
            {#if ogPreview.title || ogPreview.description || hostname}
                <Column padding={["sm", "md"]} gap="sm">
                    {#if ogPreview.title && ogPreview.description}
                        <!-- This renders only if title and description are available -->
                        <Label fontWeight="bold" colour={textColour} maxLines={2}>
                            {ogPreview.title}
                        </Label>
                    {/if}
                    {#if ogPreview.description || ogPreview.title}
                        <ChatCaption colour={textColour} maxLines={3}>
                            <!-- If we don't have description, render title instead -->
                            {ogPreview.description ?? ogPreview.title}
                        </ChatCaption>
                    {/if}
                    {#if hostname}
                        <ChatCaption fontWeight="bold" colour={urlColour} maxLines={1}>
                            {hostname}
                        </ChatCaption>
                    {/if}
                </Column>
            {/if}
        </div>
    </a>
{/if}

<style lang="scss">
    .generic-preview {
        // Prevet preveiws from breaking anchoring, this should avoid any scroll
        // jitters while previews are loading, even if they're supposed to load
        // offscreen
        overflow-anchor: none;

        .image {
            width: 100%;
        }

        &.me {
            background-color: var(--primary-muted);
        }

        &:not(.me) {
            background-color: var(--background-1);
        }
    }
</style>
