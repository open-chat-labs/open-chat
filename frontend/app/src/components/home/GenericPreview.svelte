<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { eventListScrolling } from "../../stores/scrollPos";
    import { offlineStore } from "openchat-client";

    type LinkInfo = {
        url: string;
        title: string | null | undefined;
        description: string | null | undefined;
        image: string | null | undefined;
        imageAlt: string | null | undefined;
    };

    const dispatch = createEventDispatcher();

    export let url: string;
    export let intersecting: boolean;
    export let rendered = false;

    let previewWrapper: HTMLElement;
    let previewPromise: Promise<LinkInfo | undefined> | undefined = undefined;

    $: {
        if (intersecting && !$eventListScrolling && !rendered && !$offlineStore) {
            // make sure we only actually *load* the preview once
            previewPromise = previewPromise ?? loadPreview(url);
            previewPromise.then((preview) => {
                if (preview && intersecting && !$eventListScrolling) {
                    rendered = true;
                    dispatch("rendered", url);
                }
            });
        }
    }

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

    function imageLoaded() {
        dispatch("imageLoaded", previewWrapper);
    }
</script>

{#if rendered}
    {#await previewPromise then preview}
        {#if preview}
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
                            alt={preview.imageAlt ?? "link preview image"} />
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
