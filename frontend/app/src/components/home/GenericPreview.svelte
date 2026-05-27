<script lang="ts">
    import { type OgPreview } from "openchat-client";

    interface Props {
        ogPreview: OgPreview;
        me: boolean;
    }

    let { ogPreview, me }: Props = $props();

    let cardHeight = $state(0);

    let img = $derived(
        ogPreview.image && ogPreview.image.width > 0 && ogPreview.image.height > 0
            ? ogPreview.image
            : undefined,
    );

    // Twitter-style: square-ish image that's not huge → side-by-side layout
    let smallSquare = $derived(img !== undefined && img.width === img.height && img.height < 300);

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
</script>

{#snippet card()}
    <div class="card">
        <p class="title">{ogPreview.title}</p>
        {#if ogPreview.description}
            <p class="description">{ogPreview.description}</p>
        {/if}
        <p class="hostname">{hostname}</p>
    </div>
{/snippet}

<div class="generic_preview" class:me>
    <a href={safeUrl} target="_blank" rel="noopener noreferrer" class="preview_link">
        {#if smallSquare && img}
            <!-- Side-by-side: card drives height, thumbnail is a square matching it -->
            <div class="row_layout">
                <div
                    class="thumbnail"
                    style="background-image: url({img.url}); width: {cardHeight}px; height: {cardHeight}px;">
                </div>
                <div class="card" bind:clientHeight={cardHeight}>
                    <p class="title">{ogPreview.title}</p>
                    {#if ogPreview.description}
                        <p class="description">{ogPreview.description}</p>
                    {/if}
                    <p class="hostname">{hostname}</p>
                </div>
            </div>
        {:else}
            <!-- Stack: banner on top, card below -->
            <div class="col_layout">
                {#if img}
                    <div
                        class="banner"
                        style="background-image: url({img.url}); aspect-ratio: {img.width} / {img.height}">
                    </div>
                {/if}
                {@render card()}
            </div>
        {/if}
    </a>
</div>

<style lang="scss">
    .generic_preview {
        width: 100%;
        border-radius: var(--rad-lg) var(--rad-lg) var(--rad-md) var(--rad-md);
        overflow: hidden;

        &.me .card {
            background-color: var(--primary-surface);
        }

        &:not(.me) .card {
            background-color: var(--surface-1);
        }
    }

    .preview_link {
        display: block;
        text-decoration: none;
        color: inherit;
    }

    // ── Row layout (small square image) ──────────────────────────────────────
    .row_layout {
        display: flex;
        align-items: flex-start;
        background-color: var(--chatSummary-bg-selected);

        .thumbnail {
            flex: 0 0 auto;
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            overflow: hidden;
            // width and height driven by bind:clientHeight on .card
        }

        .card {
            flex: 1;
            min-width: 0;
            overflow: hidden;
            padding: $sp3 $sp4;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: $sp2;
        }
    }

    // ── Column layout (large / landscape image) ───────────────────────────────
    .col_layout {
        display: flex;
        flex-direction: column;
        background-color: var(--chatSummary-bg-selected);

        .banner {
            width: 100%;
            max-height: 14rem;
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
        }

        .card {
            padding: $sp3 $sp4;
            display: flex;
            flex-direction: column;
            gap: $sp2;
        }
    }

    // ── Shared card content ───────────────────────────────────────────────────
    .title {
        @include font(bold, normal, fs-120);
        @include ellipsis();
        margin: 0;

        &:hover {
            text-decoration: underline;
        }
    }

    .description {
        margin: 0;
        overflow: hidden;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
        line-clamp: 3;
    }

    .hostname {
        margin: 0;
        text-transform: uppercase;
        font-weight: 300;
        @include font(book, normal, fs-80);
    }

    .card {
        background-color: var(--chatSummary-bg-selected);
    }
</style>
