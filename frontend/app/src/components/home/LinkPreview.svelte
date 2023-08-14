<script lang="ts">
    import { getContext } from "svelte";
    import Tweet from "./Tweet.svelte";
    import type { OpenChat } from "openchat-client";

    type LinkInfo = {
        title: string | null | undefined;
        description: string | null | undefined;
        image: string | null | undefined;
    };

    const client = getContext<OpenChat>("client");

    export let links: string[];
    export let intersecting: boolean;
    export let text: string;
    export let pinned: boolean;
    export let fill: boolean;
    export let height: number | undefined;

    let previews: (LinkInfo | undefined)[] = [];
    let rendered = false;

    $: youtubeMatch = text.match(client.youtubeRegex());
    $: twitterLinkMatch = text.match(client.twitterLinkRegex());
    $: youtubeCode =
        youtubeMatch && (youtubeMatch[1] ?? youtubeMatch[2] ?? youtubeMatch[3])?.split("?")[0];
    $: youtubeStartTime = youtubeMatch
        ? new URL(youtubeMatch[0]).searchParams.get("t") || "0"
        : "0";

    async function loadPreview(url: string): Promise<LinkInfo | undefined> {
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

    $: {
        if (!twitterLinkMatch && !youtubeMatch && intersecting && !rendered) {
            Promise.all(links.map(loadPreview))
                .then((res) => {
                    previews = res;
                    rendered = true;
                })
                .catch((_err) => {
                    // let's not let any error bubble up and cause problems.
                    rendered = false;
                });
        }
    }
</script>

{#if twitterLinkMatch}
    <Tweet tweetId={twitterLinkMatch[3]} {intersecting} />
{:else if youtubeMatch}
    <iframe
        class:pinned
        class:fill
        width="100%"
        {height}
        src={`https://www.youtube.com/embed/${youtubeCode}?start=${youtubeStartTime}`}
        title="YouTube video player"
        frameborder="0"
        allow="accelerometer;
                        autoplay;
                        clipboard-write;
                        encrypted-media;
                        gyroscope;
                        picture-in-picture"
        allowfullscreen />
{:else if rendered}
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

    iframe {
        margin-top: $sp3;
    }

    iframe:not(.fill) {
        border-radius: $sp3;
    }

    iframe.pinned {
        pointer-events: none;
    }
</style>
