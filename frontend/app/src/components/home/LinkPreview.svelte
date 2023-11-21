<script lang="ts">
    import { getContext } from "svelte";
    import Tweet from "./Tweet.svelte";
    import YouTubePreview from "./YouTubePreview.svelte";
    import type { OpenChat } from "openchat-client";
    import GenericPreview, { loadPreviews, type LinkInfo } from "./GenericPreview.svelte";
    import { eventListScrolling, reverseScroll } from "../../stores/scrollPos";
    import { lowBandwidth } from "../../stores/settings";

    const client = getContext<OpenChat>("client");

    export let links: string[];
    export let intersecting: boolean;
    export let text: string;
    export let pinned: boolean;
    export let fill: boolean;
    export let me: boolean;

    let rendered = false;
    let previewsPromise: Promise<LinkInfo[]> | undefined = undefined;

    let list: HTMLElement | null | undefined = undefined;

    $: youtubeMatch = text.match(client.youtubeRegex());
    $: twitterLinkMatch = text.match(client.twitterLinkRegex());
    $: networkStatus = client.networkStatus;

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

    function previewLoaded(ev: CustomEvent<HTMLElement>): void {
        // if we are using reverse scroll rendering there is no need to adjust the scroll top when rendering previews
        if (reverseScroll || $lowBandwidth) return;

        list = list || closestAncestor(ev.detail, ".scrollable-list");
        if (list) {
            list.scrollTop = list.scrollTop + ev.detail.offsetHeight;
        }
    }

    $: {
        if (
            !twitterLinkMatch &&
            !youtubeMatch &&
            intersecting &&
            !$eventListScrolling &&
            !rendered &&
            $networkStatus === "online"
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
    <Tweet on:rendered={previewLoaded} tweetId={twitterLinkMatch[3]} {intersecting} />
{:else if youtubeMatch}
    <YouTubePreview {pinned} {fill} {youtubeMatch} />
{:else if rendered}
    {#await previewsPromise then previews}
        <GenericPreview {me} {previews} on:rendered={previewLoaded} />
    {/await}
{/if}
