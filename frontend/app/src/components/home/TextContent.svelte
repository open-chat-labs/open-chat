<svelte:options immutable={false} />

<script lang="ts">
    import Markdown from "./Markdown.svelte";
    import Tweet from "./Tweet.svelte";
    import IntersectionObserver from "./IntersectionObserver.svelte";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import type { OpenChat, TextContent } from "openchat-client";
    import ArrowExpand from "svelte-material-icons/ArrowExpand.svelte";
    import { lowBandwidth } from "../../stores/settings";

    const client = getContext<OpenChat>("client");

    const SIZE_LIMIT = 1000;
    export let content: TextContent;
    export let truncate: boolean = false;
    export let pinned: boolean = false;
    export let messageId: bigint;
    export let edited: boolean;
    export let height: number | undefined = undefined;
    export let fill: boolean;

    $: expanded = !$lowBandwidth;

    function truncateText(text: string): string {
        // todo - we might be able to do something nicer than this with pure css, but we just need to do
        // *something* to make sure there a limit to the size of this box
        if (truncate && text.length > SIZE_LIMIT) {
            text = text.slice(0, SIZE_LIMIT) + "...";
        }
        return text;
    }

    $: translationStore = client.translationStore;
    $: text = truncateText($translationStore.get(Number(messageId)) ?? content.text);
    $: youtubeMatch = content.text.match(client.youtubeRegex());
    $: twitterLinkMatch = text.match(client.twitterLinkRegex());
    $: containsCodeBlock = content.text.match(/```([\s\S]*)```/);
    $: youtubeCode =
        youtubeMatch && (youtubeMatch[1] ?? youtubeMatch[2] ?? youtubeMatch[3])?.split("?")[0];
    $: youtubeStartTime = youtubeMatch
        ? new URL(youtubeMatch[0]).searchParams.get("t") || "0"
        : "0";

    function expand() {
        expanded = true;
    }
</script>

{#if !youtubeMatch}
    <Markdown inline={!containsCodeBlock} suppressLinks={pinned} {text} />
    {#if edited}
        <span class="edited-msg">({$_("edited")})</span>
    {/if}
    {#if twitterLinkMatch}
        {#if !expanded}
            <span on:touchstart={expand} on:click={expand} class="expand" title={$_("showTweet")}>
                <ArrowExpand viewBox="0 -3 24 24" size={"1em"} color={"var(--txt)"} />
            </span>
        {:else}
            <IntersectionObserver let:intersecting>
                <Tweet tweetId={twitterLinkMatch[2]} {intersecting} />
            </IntersectionObserver>
        {/if}
    {/if}
{:else}
    {#if youtubeMatch[0] !== content.text || !expanded}
        <Markdown suppressLinks={pinned} {text} />
    {/if}
    {#if !expanded}
        <span on:click={expand} on:touchstart={expand} class="expand" title={$_("showVideo")}>
            <ArrowExpand viewBox="0 -3 24 24" size={"1em"} color={"var(--txt)"} />
        </span>
    {:else}
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
    {/if}
{/if}

<style lang="scss">
    .expand {
        cursor: pointer;
        padding: 0 $sp3;
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
