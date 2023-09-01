<script lang="ts">
    import { getContext } from "svelte";
    import Tweet from "./Tweet.svelte";
    import YouTubePreview from "./YouTubePreview.svelte";
    import type { OpenChat } from "openchat-client";
    import GenericPreview, { loadPreviews, type LinkInfo } from "./GenericPreview.svelte";

    const client = getContext<OpenChat>("client");

    export let links: string[];
    export let intersecting: boolean;
    export let text: string;
    export let pinned: boolean;
    export let fill: boolean;

    let rendered = false;
    let previews: LinkInfo[] = [];

    $: youtubeMatch = text.match(client.youtubeRegex());
    $: twitterLinkMatch = text.match(client.twitterLinkRegex());

    $: {
        if (!twitterLinkMatch && !youtubeMatch && intersecting && !rendered) {
            loadPreviews(links).then((p) => {
                rendered = true;
                previews = p;
            });
        }
    }
</script>

{#if twitterLinkMatch}
    <Tweet tweetId={twitterLinkMatch[3]} {intersecting} />
{:else if youtubeMatch}
    <YouTubePreview {pinned} {fill} {youtubeMatch} />
{:else if rendered}
    <GenericPreview {previews} />
{/if}
