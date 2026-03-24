<script lang="ts">
    import { trackedEffect } from "@src/utils/effects.svelte";
    import { eventListScrolling } from "openchat-client";
    import { ChatCaption, Column, Label } from "component-lib";
    // import PreviewPlaceholder from "../PreviewPlaceholder.svelte";

    type LinkInfo = {
        url: string;
        title: string | null | undefined;
        description: string | null | undefined;
        image: string | null | undefined;
        imageAlt: string | null | undefined;
    };

    interface Props {
        me: boolean;
        url: string;
        intersecting: boolean;
        onRendered: (url: string) => void;
    }

    let { me, url, intersecting, onRendered }: Props = $props();

    let previewPromise: Promise<LinkInfo | undefined> | undefined = $state();
    let rendered = $state(false);

    async function loadPreview(url: string): Promise<LinkInfo | undefined> {
        const response = await fetch(
            `${import.meta.env.OC_PREVIEW_PROXY_URL}/preview?url=${encodeURIComponent(url)}`,
        );

        const checkIfMetaEmpty = (meta: Omit<LinkInfo, "url">) =>
            !meta.title && !meta.description && !meta.image && !meta.imageAlt;

        if (response.ok) {
            const meta = await response.json();
            const metaIsEmpty = checkIfMetaEmpty(meta);

            if (!metaIsEmpty) {
                return {
                    url,
                    title: meta.title,
                    description: meta.description,
                    image: meta.image ? new URL(meta.image, url).toString() : undefined,
                    imageAlt: meta.imageAlt,
                };
            }
        }
    }

    trackedEffect("generic-preview", () => {
        // Make sure we only actually *load* the preview once, and start only
        // if the link is in view.
        if (previewPromise || !intersecting) return;
        previewPromise = previewPromise ?? loadPreview(url);
    });

    // Render link preview separately from it being loaded, since any links
    // rendered previousl can push the links above out of view, which would
    // mean tha they get loaded, but not rendered if we're only checking the
    // render condtion within the then handler (which was the case before).
    $effect(() => {
        if (previewPromise && !rendered && intersecting) {
            previewPromise?.then((preview) => {
                if (preview && !$eventListScrolling) {
                    rendered = true;
                    onRendered(url);
                }
            });
        }
    });

    const urlDomain = $derived.by(() => {
        if (url) {
            const parsed = new URL(url);
            return parsed.hostname;
        }
    });
    const textColour = $derived(me ? "primaryLight" : "textSecondary");
    const urlColour = $derived(me ? "textPrimary" : "secondary");
</script>

{#if rendered}
    {#await previewPromise then preview}
        {#if preview}
            <a href={preview.url} target="_blank">
                <div class="generic-preview" class:me>
                    {#if preview.image}
                        <img class="image" src={preview.image} alt={preview.imageAlt ?? ""} />
                    {/if}
                    {#if preview.title || preview.description || urlDomain}
                        <Column padding={["sm", "md"]} gap="sm">
                            {#if preview.title && preview.description}
                                <!-- This renders only if title and description are available -->
                                <Label fontWeight="bold" colour={textColour} maxLines={2}>
                                    {preview.title}
                                </Label>
                            {/if}
                            {#if preview.description || preview.title}
                                <ChatCaption colour={textColour} maxLines={3}>
                                    <!-- If we don't have description, render title instead -->
                                    {preview.description ?? preview.title}
                                </ChatCaption>
                            {/if}
                            {#if urlDomain}
                                <ChatCaption fontWeight="bold" colour={urlColour} maxLines={1}>
                                    {urlDomain}
                                </ChatCaption>
                            {/if}
                        </Column>
                    {/if}
                </div>
            </a>
        {/if}
    {/await}
    <!-- TODO render placeholder in case it takes a while to get the link info -->
    <!-- {:else} <PreviewPlaceholder kind="generic_preview" {me} /> -->
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
