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
    let list: HTMLElement | null | undefined = undefined;
    let previews: LinkInfo[] = [];

    $: youtubeMatch = text.match(client.youtubeRegex());
    $: twitterLinkMatch = text.match(client.twitterLinkRegex());

    function closestAncestor(
        el: HTMLElement | null | undefined,
        selector: string
    ): HTMLElement | null | undefined {
        while (el) {
            if (el.matches(selector)) {
                return el;
            }
            el = el.parentElement;
        }
        return null;
    }

    function previewLoaded(ev: CustomEvent<[HTMLElement, number]>): void {
        list = list || closestAncestor(ev.detail[0], ".scrollable-list");
        if (list) {
            list.scrollTop = list.scrollTop + ev.detail[1];
        }
    }

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
    <Tweet on:loaded={previewLoaded} tweetId={twitterLinkMatch[3]} {intersecting} />
{:else if youtubeMatch}
    <YouTubePreview on:loaded={previewLoaded} {pinned} {fill} {youtubeMatch} />
{:else if rendered}
    <GenericPreview {previews} on:loaded={previewLoaded} />
{/if}
