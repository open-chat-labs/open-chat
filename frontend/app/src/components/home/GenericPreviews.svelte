<script lang="ts" context="module">
    import { waitAll } from "openchat-client";
    import { createEventDispatcher, onMount } from "svelte";
    import CloseIcon from "svelte-material-icons/Close.svelte";
    import { iconSize } from "../../stores/iconSize";

    export type LinkInfo = {
        url: string;
        title: string | null | undefined;
        description: string | null | undefined;
        image: string | null | undefined;
        removed: boolean;
    };

    export async function loadPreviews(links: string[]): Promise<LinkInfo[]> {
        const res = await waitAll(links.map(loadPreview));
        return res.success;
    }

    async function loadPreview(url: string): Promise<LinkInfo> {
        const response = await fetch(`https://proxy.cors.sh/${url}`, {
            headers: {
                "x-cors-api-key": process.env.CORS_APIKEY!,
            },
        });

        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const title = doc.querySelector('meta[property="og:title"]')?.getAttribute("content");
        const description = doc
            .querySelector('meta[property="og:description"]')
            ?.getAttribute("content");
        const image = doc.querySelector('meta[property="og:image"]')?.getAttribute("content");

        return {
            url,
            title,
            description,
            image: image ? new URL(image, url).toString() : undefined,
            removed: false,
        };
    }
</script>

<script lang="ts">
    const dispatch = createEventDispatcher();

    export let previews: (LinkInfo | undefined)[] = [];
    export let me: boolean;

    let previewsWrapper: HTMLElement;
    let numberOfImagesLoaded = 0;
    let imageCount = 0;

    function imageLoaded() {
        numberOfImagesLoaded += 1;
        if (numberOfImagesLoaded >= imageCount && previewsWrapper) {
            dispatch("rendered", previewsWrapper);
        }
    }

    function removePreview(preview: LinkInfo | undefined) {
        if (preview) {
            // preview.removed = true;
            // previews = [...previews];
            dispatch("remove", preview.url);
        }
    }

    onMount(() => {
        imageCount = previews.reduce((count, p) => {
            return p?.image ? count + 1 : count;
        }, 0);
    });
</script>

<div bind:this={previewsWrapper}>
    {#each previews as preview}
        {#if preview !== undefined && !preview.removed && (preview.title !== undefined || preview.description !== undefined || preview.image !== undefined)}
            <div class="preview" class:me>
                {#if me}
                    <div class="remove" on:click={() => removePreview(preview)}>
                        <CloseIcon
                            viewBox="0 0 24 24"
                            size={$iconSize}
                            color={"var(--button-txt)"} />
                    </div>
                {/if}
                {#if preview.title}
                    <h3 class="title">{preview.title}</h3>
                {/if}
                {#if preview.description}
                    <p class="desc">{preview.description}</p>
                {/if}
                {#if preview.image}
                    <img
                        on:load={imageLoaded}
                        on:error={imageLoaded}
                        class="image"
                        src={preview.image}
                        alt="link preview image" />
                {/if}
            </div>
        {/if}
    {/each}
</div>

<style lang="scss">
    .preview {
        position: relative;
        margin-top: $sp4;
        border-top: 1px solid var(--currentChat-msg-separator);

        &.me {
            border-color: var(--currentChat-msg-me-separator);
        }

        .remove {
            cursor: pointer;
            position: absolute;
            display: flex;
            top: 8px;
            right: 0px;
        }
    }

    .title {
        @include font(bold, normal, fs-120);
        margin: $sp3 0 $sp2 0;
    }
    .desc {
        margin-bottom: $sp3;
    }
    .image {
        border-radius: $sp3;
        max-height: 300px;
        max-width: 100%;
    }
</style>
