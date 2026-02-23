<script lang="ts">
    import { trackedEffect } from "@src/utils/effects.svelte";
    import { eventListScrolling } from "openchat-client";
    import { ChatCaption, Column, Label, ColourVars } from "component-lib";
    import TooltipImageOutline from "svelte-material-icons/TooltipImageOutline.svelte";

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
        setTimeout(() => {
            // make sure we only actually *load* the preview once
            previewPromise = previewPromise ?? loadPreview(url);
            previewPromise.then((preview) => {
                if (preview && intersecting && !$eventListScrolling) {
                    rendered = true;
                    onRendered(url);
                }
            });
        }, 2000);
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

{#snippet previewPlaceholder()}
    <!-- TODO indicate loading? -->
    <div class="generic-preview placeholder" class:me>
        <div
            class="image-preview"
            style:background-color={me ? ColourVars.myChatBubble : ColourVars.background2}>
            <TooltipImageOutline
                size="3rem"
                color={me ? ColourVars.primaryMuted : ColourVars.background1} />
        </div>
        <Column padding={["sm", "md"]} gap="sm" width="fill">
            <div class="title-preview">
                <div class="row w100"></div>
                <div class="row w75"></div>
            </div>
            <div class="desc-preview">
                <div class="row w95"></div>
                <div class="row w60"></div>
            </div>
            <div class="domain-preview">
                <div class="row w25"></div>
            </div>
        </Column>
    </div>
{/snippet}

{#if rendered}
    {#await previewPromise}
        {@render previewPlaceholder()}
    {:then preview}
        {#if preview}
            <a href={preview.url} target="_blank">
                <div class="generic-preview" class:me>
                    {#if preview.image}
                        <!-- <img
                            class="image"
                            src={preview.image}
                            alt={preview.imageAlt ?? "link preview image"} /> -->
                        <div class="image" style:background-image={`url(${preview.image})`}></div>
                    {/if}
                    {#if preview.title || preview.description || urlDomain}
                        <Column padding={["sm", "md"]} gap="sm">
                            {#if preview.title}
                                <Label fontWeight="bold" colour={textColour} maxLines={2}>
                                    {preview.title}
                                </Label>
                            {/if}
                            {#if preview.description}
                                <ChatCaption colour={textColour} maxLines={3}>
                                    {preview.description}
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
{:else}
    {@render previewPlaceholder()}
{/if}

<style lang="scss">
    .generic-preview {
        width: 78vw; // Same as max message bubble width
        margin: -0.5rem -0.5rem 0 -0.5rem;

        .image {
            height: 12rem;
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
        }

        &.me {
            background-color: var(--primary-muted);
        }

        &:not(.me) {
            background-color: var(--background-1);
        }
    }

    .generic-preview.placeholder {
        .row {
            width: 50%;
            height: 0.75rem;
            margin: 0.5rem 0;
            border-radius: var(--rad-lg);

            &.w100 {
                width: 100%;
            }
            &.w95 {
                width: 95%;
            }
            &.w75 {
                width: 75%;
            }
            &.w65 {
                width: 65%;
            }
            &.w25 {
                width: 25%;
            }
        }

        &.me .row {
            background-color: var(--my-chat-bubble);
        }

        &:not(.me) .row {
            background-color: var(--background-2);
        }

        .image-preview {
            height: 10rem;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .image-preview,
        .title-preview,
        .desc-preview,
        .domain-preview {
            width: 100%;
        }
    }
</style>
