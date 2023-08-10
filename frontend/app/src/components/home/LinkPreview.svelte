<script lang="ts">
    import FancyLoader from "../icons/FancyLoader.svelte";

    type LinkInfo = {
        title: string | null | undefined;
        description: string | null | undefined;
        image: string | null | undefined;
    };

    export let links: string[];
    export let intersecting = false;

    let previews: (LinkInfo | undefined)[] = [];
    let state: "rendered" | "rendering" | "not_rendered" = "not_rendered";

    async function loadPreview(url: string): Promise<LinkInfo | undefined> {
        const response = await fetch(`https://proxy.cors.sh/${url}`, {
            headers: {
                "x-cors-api-key": "temp_9f7ad96c6a7e9e22603435fe56fb5b2e",
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

    $: {
        if (intersecting && state === "not_rendered") {
            state = "rendering";
            Promise.all(links.map(loadPreview))
                .then((res) => {
                    previews = res;
                    state = "rendered";
                })
                .catch((err) => {
                    console.error("Error rendering link(s)", err);
                    state = "not_rendered";
                });
        }
    }
</script>

{#if state === "rendered"}
    {#each previews as preview}
        {#if preview !== undefined}
            {#if preview.title}
                <h3 class="title">{preview.title}</h3>
            {/if}
            {#if preview.description}
                <p class="desc">{preview.description}</p>
            {/if}
            {#if preview.image}
                <img class="image" src={preview.image} alt="link preview image" />
            {/if}
        {/if}
    {/each}
{/if}
{#if state === "rendering"}
    <div class="logo-wrapper">
        <div class="logo">
            <FancyLoader loop />
        </div>
    </div>
{/if}

<style lang="scss">
    $size: 60px;

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
    .logo-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: $sp5;

        .logo {
            width: $size;
            height: $size;
        }
    }
</style>
