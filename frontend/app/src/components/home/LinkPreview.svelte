<script lang="ts">
    import { getContext } from "svelte";
    import Tweet from "./Tweet.svelte";
    import YouTubePreview from "./YouTubePreview.svelte";
    import type { OpenChat } from "openchat-client";
    import GenericPreview, { loadPreviews, type LinkInfo } from "./GenericPreview.svelte";
    import { eventListScrolling } from "../../stores/scrollPos";

    const client = getContext<OpenChat>("client");

    export let links: string[];
    export let intersecting: boolean;
    export let text: string;
    export let pinned: boolean;
    export let fill: boolean;

    let rendered = false;
    let previewsPromise: Promise<LinkInfo[]> | undefined = undefined;

    $: youtubeMatch = text.match(client.youtubeRegex());
    $: twitterLinkMatch = text.match(client.twitterLinkRegex());

    $: {
        if (
            !twitterLinkMatch &&
            !youtubeMatch &&
            intersecting &&
            !$eventListScrolling &&
            !rendered
        ) {
            // make sure we only actually *load* the preview(s) once
            previewsPromise = previewsPromise ?? loadPreviews(links);
            previewsPromise.then(() => {
                // only render the preview if we are *still* intersecting
                if (intersecting && !$eventListScrolling) {
                    rendered = true;
                }
            });
        }
    }
</script>

{#if twitterLinkMatch}
    <Tweet tweetId={twitterLinkMatch[3]} {intersecting} />
{:else if youtubeMatch}
    <YouTubePreview {pinned} {fill} {youtubeMatch} />
{:else if rendered}
    {#await previewsPromise then previews}
        <GenericPreview {previews} />
    {/await}
{/if}
