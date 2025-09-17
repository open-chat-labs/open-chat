<script lang="ts">
    import { previewHeightObserver } from "@utils/previewHeightObserver";
    import {
        eventListScrolling,
        iconSize,
        offlineStore,
        type MultiUserChatIdentifier,
        type OpenChat,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import CloseIcon from "svelte-material-icons/Close.svelte";
    import { rtlStore } from "../../stores/rtl";
    import GenericPreviewComponent from "./GenericPreview.svelte";
    import InstagramPreviewComponent from "./InstagramPreview.svelte";
    import MessagePreviewComponent from "./MessagePreview.svelte";
    import SpotifyPreviewComponent from "./SpotifyPreview.svelte";
    import Tweet from "./Tweet.svelte";
    import YouTubePreview from "./YouTubePreview.svelte";

    type Preview =
        | SpotifyPreview
        | YoutubePreview
        | TwitterPreview
        | InstagramPreview
        | MessagePreview
        | GenericPreview;

    type PreviewBase = {
        url: string;
        container?: HTMLElement;
    };

    type YoutubePreview = PreviewBase & {
        kind: "youtube";
        regexMatch: RegExpMatchArray;
    };

    type InstagramPreview = PreviewBase & {
        kind: "instagram";
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

    type MessagePreview = PreviewBase & {
        kind: "message";
        chatId: MultiUserChatIdentifier;
        threadRootMessageIndex: number | undefined;
        messageIndex: number;
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

    let previousLinks = links;
    let previews: Preview[] = $state(links.map(buildPreview));
    let shouldRenderPreviews = $state(false);
    let rtl = $rtlStore;

    function arraysAreEqual(a: string[], b: string[]) {
        if (a === b) return true;
        if (a.length !== b.length) return false;

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

        regexMatch = url.match(client.instagramRegex());
        if (regexMatch) {
            return {
                kind: "instagram",
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

        const messagePreview = parseMessageUrl(url);
        if (messagePreview) {
            return messagePreview;
        }

        return {
            kind: "generic",
            url,
        };
    }

    function parseMessageUrl(urlText: string): MessagePreview | undefined {
        const url = new URL(urlText);
        if (!url) return;

        if (
            url.hostname !== "oc.app" &&
            !url.hostname.endsWith(".oc.app") &&
            url.hostname !== "localhost"
        ) {
            return;
        }

        let regexMatch = url.pathname.match(client.communityMessageRegex());
        if (regexMatch) {
            return {
                kind: "message",
                url: urlText,
                chatId: {
                    kind: "channel",
                    communityId: regexMatch[1],
                    channelId: Number(regexMatch[2]),
                },
                threadRootMessageIndex: regexMatch[4] ? Number(regexMatch[3]) : undefined,
                messageIndex: regexMatch[4] ? Number(regexMatch[4]) : Number(regexMatch[3]),
            };
        }

        regexMatch = url.pathname.match(client.groupMessageRegex());
        if (regexMatch) {
            return {
                kind: "message",
                url: urlText,
                chatId: {
                    kind: "group_chat",
                    groupId: regexMatch[1],
                },
                threadRootMessageIndex: regexMatch[3] ? Number(regexMatch[2]) : undefined,
                messageIndex: regexMatch[3] ? Number(regexMatch[3]) : Number(regexMatch[2]),
            };
        }
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

    onMount(() => {
        const toUnobserve: Element[] = [];
        for (const preview of previews) {
            if (preview.container) {
                previewHeightObserver.observe(preview.container, preview.url);
                toUnobserve.push(preview.container);

                const height = previewHeightObserver.getHeight(preview.url);
                if (height) {
                    preview.container.style.setProperty("min-height", `${height}px`);
                }
                if (preview.kind === "generic") {
                    // If we have a recorded height for this preview then display the container immediately, else hide it
                    // until we have fetched the preview (if any)
                    const display = height ? "flex" : "none";
                    preview.container.style.setProperty("display", display);
                }
            }
        }
        return () => toUnobserve.forEach((e) => previewHeightObserver.unobserve(e));
    });

    $effect(() => {
        if (intersecting && !$eventListScrolling && !shouldRenderPreviews && !$offlineStore) {
            shouldRenderPreviews = true;
        }
    });

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
        class:visible={preview.kind !== "generic" && preview.kind !== "message"}
        class:me>
        {#if me}
            <div class="remove-wrapper" class:rtl>
                <div class="remove" onclick={() => removePreview(preview)}>
                    <CloseIcon viewBox="0 0 24 24" size={$iconSize} color={"var(--button-txt)"} />
                </div>
            </div>
        {/if}
        <div class="inner" class:me>
            {#if shouldRenderPreviews}
                {#if preview.kind === "twitter"}
                    <Tweet tweetId={preview.tweetId} />
                {:else if preview.kind === "youtube"}
                    <YouTubePreview
                        {pinned}
                        fill={fill && previews.length === 1}
                        youtubeMatch={preview.regexMatch} />
                {:else if preview.kind === "instagram"}
                    <InstagramPreviewComponent instagramMatch={preview.regexMatch} />
                {:else if preview.kind === "spotify"}
                    <SpotifyPreviewComponent
                        {pinned}
                        fill={fill && previews.length === 1}
                        matches={preview.regexMatch} />
                {:else if preview.kind === "message"}
                    <MessagePreviewComponent
                        url={preview.url}
                        {me}
                        chatId={preview.chatId}
                        threadRootMessageIndex={preview.threadRootMessageIndex}
                        messageIndex={preview.messageIndex}
                        {intersecting}
                        onRendered={renderPreview} />
                {:else}
                    <GenericPreviewComponent
                        url={preview.url}
                        {intersecting}
                        onRendered={renderPreview} />
                {/if}
            {/if}
        </div>
    </div>
{/each}

<style lang="scss">
    .preview {
        display: none;
        margin-top: $sp4;
        border-color: var(--currentChat-msg-separator);
        flex-direction: row-reverse;
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
            visibility: hidden;

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
            border-inline-start: $sp2 solid var(--currentChat-msg-separator);
            padding-inline-start: 12px;
            max-width: 100%;

            &.me {
                border-color: var(--currentChat-msg-me-separator);
            }
        }
    }

    .preview:hover .remove-wrapper {
        visibility: visible;
    }
</style>
