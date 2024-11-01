<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { eventListScrolling } from "../../stores/scrollPos";
    import { offlineStore } from "openchat-client";

    type LinkInfo = {
        url: string;
        title: string | null | undefined;
        description: string | null | undefined;
        image: string | null | undefined;
    };

    const dispatch = createEventDispatcher();

    export let url: string;
    export let intersecting: boolean;
    export let rendered = false;

    let previewWrapper: HTMLElement;
    let previewPromise: Promise<LinkInfo> | undefined = undefined;

    $: {
        if (intersecting && !$eventListScrolling && !rendered && !$offlineStore) {
            // make sure we only actually *load* the preview once
            previewPromise = previewPromise ?? loadPreview(url);
            previewPromise.then((preview) => {
                if (
                    preview.title !== undefined ||
                    preview.description !== undefined ||
                    preview.image !== undefined
                ) {
                    if (intersecting && !$eventListScrolling) {
                        rendered = true;
                        dispatch("rendered", url);
                    }
                }
            });
        }
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
        };
    }

    function imageLoaded() {
        dispatch("imageLoaded", previewWrapper);
    }
</script>

{#if rendered}
    {#await previewPromise then preview}
        {#if preview !== undefined}
            <div bind:this={previewWrapper}>
                {#if preview.title}
                    <a class="title" href={preview.url} target="_blank">{preview.title}</a>
                {/if}
                {#if preview.description}
                    <p class="desc">{preview.description}</p>
                {/if}
                {#if preview.image}
                    <a href={preview.url} target="_blank">
                        <img
                            on:load={imageLoaded}
                            on:error={imageLoaded}
                            class="image"
                            src={preview.image}
                            alt="link preview image" />
                    </a>
                {/if}
            </div>
        {/if}
    {/await}
{/if}

<style lang="scss">
    .title {
        @include font(bold, normal, fs-120);
        margin: $sp3 0 $sp3 0;
        display: block;

        &:hover {
            text-decoration: underline;
        }
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
