<script lang="ts">
    import { ui, type OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import CloseIcon from "svelte-material-icons/Close.svelte";
    import { rtlStore } from "../../stores/rtl";
    import GenericPreviewComponent from "./GenericPreview.svelte";
    import SpotifyPreviewComponent from "./SpotifyPreview.svelte";
    import Tweet from "./Tweet.svelte";
    import YouTubePreview from "./YouTubePreview.svelte";

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

    interface Props {
        links: string[];
        intersecting: boolean;
        pinned: boolean;
        fill: boolean;
        me: boolean;
        onRemove?: (url: string) => void;
    }

    let { links, intersecting, pinned, fill, me, onRemove }: Props = $props();

    let previousLinks: string[] = $state([]);
    let previews: Preview[] = $state([]);

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

    function renderPreview(url: string): void {
        for (const preview of previews) {
            if (preview.url === url && preview.container) {
                preview.container.style.setProperty("display", "flex");
                break;
            }
        }
    }

    function removePreview(preview: Preview | undefined) {
        if (preview) {
            onRemove?.(preview.url);
        }
    }
    $effect(() => {
        if (!arraysAreEqual(previousLinks, links)) {
            previews = links.map(buildPreview);
            previousLinks = links;
        }
    });
</script>

{#each previews as preview (preview.url)}
    <div
        class="preview"
        bind:this={preview.container}
        class:visible={preview.kind !== "generic"}
        class:me>
        {#if me}
            <div class="remove-wrapper" class:rtl={$rtlStore}>
                <div class="remove" onclick={() => removePreview(preview)}>
                    <CloseIcon viewBox="0 0 24 24" size={ui.iconSize} color={"var(--button-txt)"} />
                </div>
            </div>
        {/if}
        <div class="inner">
            {#if preview.kind === "twitter"}
                <Tweet tweetId={preview.tweetId} {intersecting} />
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
                <GenericPreviewComponent
                    url={preview.url}
                    {intersecting}
                    onRendered={renderPreview} />
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
