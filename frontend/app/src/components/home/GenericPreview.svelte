<script lang="ts" context="module">
    import { waitAll } from "openchat-client";
    import { createEventDispatcher, onMount } from "svelte";

    export type LinkInfo = {
        title: string | null | undefined;
        description: string | null | undefined;
        image: string | null | undefined;
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
            title,
            description,
            image,
        };
    }
</script>

<script lang="ts">
    export let previews: (LinkInfo | undefined)[] = [];
    import { lowBandwidth } from "../../stores/settings";

    const dispatch = createEventDispatcher();

    let previewsWrapper: HTMLElement | undefined;
    let numberOfImagesLoaded = 0;
    let imageCount = 0;

    function imageLoaded() {
        numberOfImagesLoaded += 1;
        if (numberOfImagesLoaded >= imageCount && previewsWrapper && !$lowBandwidth) {
            dispatch("loaded", [previewsWrapper, previewsWrapper.offsetHeight]);
        }
    }

    onMount(() => {
        imageCount = previews.reduce((count, p) => {
            return p?.image ? count + 1 : count;
        }, 0);
    });
</script>

<div bind:this={previewsWrapper} class="previews">
    {#each previews as preview}
        {#if preview !== undefined}
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
        {/if}
    {/each}
</div>

<style lang="scss">
    .title {
        @include font(bold, normal, fs-120);
        margin: $sp3 0 $sp2 0;
    }
    .desc {
        margin-bottom: $sp3;
    }
    .image {
        width: 100%;
        border-radius: $sp3;
    }
</style>
