<script lang="ts">
    import { createEventDispatcher, getContext } from "svelte";
    import Tweet from "./Tweet.svelte";
    import YouTubePreview from "./YouTubePreview.svelte";
    import SpotifyPreviewComponent from "./SpotifyPreview.svelte";
    import type { OpenChat } from "openchat-client";
    import GenericPreview from "./GenericPreview.svelte";
    import { reverseScroll } from "../../stores/scrollPos";
    import { lowBandwidth } from "../../stores/settings";
    import CloseIcon from "svelte-material-icons/Close.svelte";
    import { iconSize } from "../../stores/iconSize";
    import { rtlStore } from "../../stores/rtl";

    type Preview = SpotifyPreview | YoutubePreview | TwitterPreview | GenericPreview;

    type PreviewBase = {
        url: string;
        container?: HTMLElement;
    };

    type YoutubePreview = PreviewBase & {
        kind: "youtube";
        regexMatch: RegExpMatchArray;
    };

    type TwitterPreview = PreviewBase & {
        kind: "twitter";
        tweetId: string;
    };

    type SpotifyPreview = PreviewBase & {
        kind: "spotify";
        regexMatch: RegExpMatchArray;
    };

    type GenericPreview = PreviewBase & {
        kind: "generic";
    };

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let links: string[];
    export let intersecting: boolean;
    export let pinned: boolean;
    export let fill: boolean;
    export let me: boolean;

    let list: HTMLElement | null | undefined = undefined;
    let previousLinks: string[] = [];
    let previews: Preview[] = [];

    $: {
        if (!arraysAreEqual(previousLinks, links)) {
            previews = links.map(buildPreview);
            previousLinks = links;
        }
    }

    function arraysAreEqual(a: string[], b: string[]) {
        if (a.length !== b.length) {
            return false;
        }

        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) {
                return false;
            }
        }

        return true;
    }

    function buildPreview(url: string): Preview {
        let regexMatch = url.match(client.youtubeRegex());
        if (regexMatch) {
            return {
                kind: "youtube",
                url,
                regexMatch,
            };
        }

        regexMatch = url.match(client.twitterLinkRegex());
        if (regexMatch) {
            return {
                kind: "twitter",
                url,
                tweetId: regexMatch[3],
            };
        }

        regexMatch = url.match(client.spotifyRegex());
        if (regexMatch) {
            return {
                kind: "spotify",
                url,
                regexMatch,
            };
        }

        return {
            kind: "generic",
            url,
        };
    }

    function closestAncestor(
        el: HTMLElement | null | undefined,
        selector: string,
    ): HTMLElement | null | undefined {
        while (el) {
            if (el.matches(selector)) {
                return el;
            }
            el = el.parentElement;
        }
        return null;
    }

    function renderPreview(url: string): void {
        for (const preview of previews) {
            if (preview.url === url && preview.container) {
                preview.container.style.setProperty("display", "flex");
                break;
            }
        }
    }

    function adjustScroll(wrapper: HTMLElement) {
        // if we are using reverse scroll rendering there is no need to adjust the scroll top when rendering previews
        if ($reverseScroll || $lowBandwidth) return;

        list = list || closestAncestor(wrapper, ".scrollable-list");
        if (list) {
            list.scrollTop = list.scrollTop + wrapper.offsetHeight;
        }
    }

    function removePreview(preview: Preview | undefined) {
        if (preview) {
            dispatch("remove", preview.url);
        }
    }
</script>

{#each previews as preview (preview.url)}
    <div
        class="preview"
        bind:this={preview.container}
        class:visible={preview.kind !== "generic"}
        class:me>
        {#if me}
            <div class="remove-wrapper" class:rtl={$rtlStore}>
                <div class="remove" on:click={() => removePreview(preview)}>
                    <CloseIcon viewBox="0 0 24 24" size={$iconSize} color={"var(--button-txt)"} />
                </div>
            </div>
        {/if}
        <div class="inner">
            {#if preview.kind === "twitter"}
                <Tweet
                    tweetId={preview.tweetId}
                    {intersecting}
                    on:rendered={(ev) => adjustScroll(ev.detail)} />
            {:else if preview.kind === "youtube"}
                <YouTubePreview
                    {pinned}
                    fill={fill && previews.length === 1}
                    youtubeMatch={preview.regexMatch} />
            {:else if preview.kind === "spotify"}
                <SpotifyPreviewComponent
                    {pinned}
                    fill={fill && previews.length === 1}
                    matches={preview.regexMatch} />
            {:else}
                <GenericPreview
                    url={preview.url}
                    {intersecting}
                    on:imageLoaded={(ev) => adjustScroll(ev.detail)}
                    on:rendered={(ev) => renderPreview(ev.detail)} />
            {/if}
        </div>
    </div>
{/each}

<style lang="scss">
    .preview {
        margin-top: $sp4;
        border-top: 1px solid var(--currentChat-msg-separator);
        padding-top: $sp2;
        display: none;
        flex-direction: row-reverse;
        gap: $sp1;
        word-break: break-word;

        &.me {
            border-color: var(--currentChat-msg-me-separator);
        }

        &.visible {
            display: flex;
        }

        .remove-wrapper {
            flex: 0;
            position: relative;
            left: 6px;

            &.rtl {
                right: 6px;
                left: unset;
            }
        }

        .remove {
            cursor: pointer;
            display: flex;
        }

        .inner {
            flex: 1;
        }
    }
</style>
