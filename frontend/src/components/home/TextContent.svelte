<svelte:options immutable={false} />

<script lang="ts">
    import Markdown from "./Markdown.svelte";
    import { translationStore } from "../../stores/translation";
    import { _ } from "svelte-i18n";
    import type { TextContent } from "../../domain/chat/chat";
    import { youtubeRegex, twitterLinkRegex } from "../../utils/media";
    import { themeStore } from "../../theme/themes";

    const SIZE_LIMIT = 1000;
    export let content: TextContent;
    export let truncate: boolean = false;
    export let pinned: boolean = false;
    export let messageId: bigint;
    export let edited: boolean;
    export let height: number | undefined = undefined;
    export let fill: boolean;

    let tweetWrapper: HTMLDivElement | undefined;
    let tweetRendered = false;

    function truncateText(text: string): string {
        // todo - we might be able to do something nicer than this with pure css, but we just need to do
        // *something* to make sure there a limit to the size of this box
        if (truncate && text.length > SIZE_LIMIT) {
            text = text.slice(0, SIZE_LIMIT) + "...";
        }
        return text;
    }

    $: text = truncateText($translationStore.get(Number(messageId)) ?? content.text);
    $: socialVideoMatch = content.text.match(youtubeRegex());
    $: twitterLinkMatch = content.text.match(twitterLinkRegex());
    $: {
        if (twitterLinkMatch && tweetWrapper !== undefined && !tweetRendered) {
            tweetWrapper.innerHTML = "";
            window.twttr.widgets
                .createTweet(twitterLinkMatch[2], tweetWrapper, {
                    conversation: "none",
                    theme: $themeStore,
                })
                .then(() => {
                    tweetRendered = true;
                });
        }
    }
</script>

{#if !socialVideoMatch}
    <Markdown suppressLinks={pinned} {text} />
    {#if edited}
        <span class="edited-msg">({$_("edited")})</span>
    {/if}
    {#if twitterLinkMatch}
        <div class:rendered={tweetRendered} class="tweet" bind:this={tweetWrapper} />

        {#if !tweetRendered}
            Loading tweet preview ...
        {/if}
    {/if}
{:else}
    <div class="social-video">
        {#if socialVideoMatch[0] !== content.text}
            <p class="social-video-txt">
                <Markdown suppressLinks={pinned} {text} />
            </p>
        {/if}
        <iframe
            class:pinned
            class:fill
            width="100%"
            {height}
            src={`https://www.youtube.com/embed/${socialVideoMatch[1] ?? socialVideoMatch[2]}`}
            title="YouTube video player"
            frameborder="0"
            allow="accelerometer;
                        autoplay;
                        clipboard-write;
                        encrypted-media;
                        gyroscope;
                        picture-in-picture"
            allowfullscreen />
    </div>
{/if}

<style type="text/scss">
    .tweet {
        min-width: 500px;

        @include mobile() {
            min-width: unset;
        }
    }
    .social-video-txt {
        margin-bottom: $sp3;
    }

    iframe:not(.fill) {
        border-radius: $sp3;
    }

    iframe.pinned {
        pointer-events: none;
    }
</style>
