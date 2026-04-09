<script lang="ts">
    import { ChatCaption, Column, ColourVars, ChatFootnote, Row } from "component-lib";
    import { type Snippet } from "svelte";
    import { rtlStore } from "../../stores/rtl";
    import { publish } from "openchat-client";
    import type { VideoContent } from "openchat-client";
    import { getProxyAdjustedBlobUrl, getVideoDuration } from "../../utils/media";
    import { i18nKey } from "@src/i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import MessageRenderer from "./MessageRenderer.svelte";
    import { setPlayingMedia } from "../../utils/media";
    import PlayCircleOutline from "svelte-material-icons/PlayCircleOutline.svelte";
    import VideoOutline from "svelte-material-icons/VideoOutline.svelte";

    const MIN_VIDEO_WIDTH = 180;

    interface Props {
        content: VideoContent;
        contentWidth?: number;
        title?: Snippet;
        fill: boolean;
        me: boolean;
        reply?: boolean;
        draft?: boolean;
        height?: number | undefined;
        edited: boolean;
        blockLevelMarkdown?: boolean;
        isPreview?: boolean;
        onRemove?: () => void;
    }

    let {
        content,
        contentWidth = $bindable(),
        title,
        fill,
        me,
        reply = false,
        draft = false,
        height = undefined,
        edited,
        blockLevelMarkdown = false, // isPreview = false,
        onRemove,
    }: Props = $props();

    let poster: HTMLImageElement | undefined = $state();
    let videoPlayer: HTMLVideoElement | undefined = $state();
    let landscape = $derived(content.height < content.width);
    let imageUrl = $derived(getProxyAdjustedBlobUrl(content.imageData.blobUrl));
    let videoUrl = $derived(getProxyAdjustedBlobUrl(content.videoData.blobUrl));
    let videoDuration = $state<string>();
    let posterHeight = $derived(draft || reply ? 70 : (height ?? 400));
    let posterWidth = $derived((posterHeight * content.width) / content.height);

    $effect(() => {
        contentWidth = posterWidth;
    });
    $effect(() => {
        if (videoUrl && videoDuration === undefined) {
            getVideoDuration(videoUrl).then((duration) => {
                videoDuration = formatDuration(Math.round(duration));
            });
        }
    });

    function formatDuration(duration: number): string {
        if (duration === undefined) return "--:--";

        const pad = (val: number) => `${val < 10 ? "0" : ""}${val}`;
        const mins = Math.floor(duration / 60);
        const secs = duration % 60;
        return `${pad(mins)}:${pad(secs)}`;
    }

    function onPlayDraftPreview() {
        if (videoPlayer) {
            setPlayingMedia(videoPlayer);
        }
    }

    function playVideo() {
        publish("playVideo", content);
    }
</script>

<!-- Reply to a video-->
{#snippet replyView(textContent?: Snippet)}
    <Row gap="sm">
        <Column width="fill" gap="xxs" padding={textContent ? "zero" : ["xs", "zero"]}>
            {@render title?.()}
            {#if textContent}
                {@render textContent()}
            {:else}
                <Row gap="xs" crossAxisAlignment="center">
                    <VideoOutline
                        color={me ? ColourVars.secondaryLight : ColourVars.primaryLight}
                        size="1.25rem" />
                    <ChatCaption colour={me ? "secondaryLight" : "primaryLight"}>
                        <Translatable resourceKey={i18nKey("Video")} />
                    </ChatCaption>
                </Row>
            {/if}
        </Column>

        <Column supplementalClass="reply_image_preview" width="hug" height="fill">
            <div class="img" style="background-image:url({imageUrl});"></div>
            <div class="play_icon">
                <PlayCircleOutline class="play" size="1.25rem" color={ColourVars.textPrimary} />
            </div>
        </Column>
    </Row>
{/snippet}

<!-- Message draft of a video -->
{#snippet draftView()}
    <Column width={"fill"}>
        <div class="video_draft">
            <div class="video_wrapper" class:rtl={$rtlStore}>
                <video
                    preload="none"
                    poster={content.imageData.blobUrl}
                    class:landscape
                    class="video"
                    style={height === undefined ? undefined : `height: ${height}px`}
                    controls
                    onplay={onPlayDraftPreview}
                    bind:this={videoPlayer}>
                    <track kind="captions" />
                    {#if content.videoData.blobUrl}
                        <source src={content.videoData.blobUrl} />
                    {/if}
                </video>
            </div>
        </div>
    </Column>
{/snippet}

<!-- Rendered video message -->
{#snippet regularView(textContent?: Snippet)}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div role="button" class="video_regular" class:reply class:rtl={$rtlStore} onclick={playVideo}>
        <img
            bind:this={poster}
            alt="..."
            class="preview_img"
            class:landscape
            class:fill
            class:me
            src={imageUrl}
            style:height={`${posterHeight}px`}
            style:width={poster && poster.complete ? undefined : `${MIN_VIDEO_WIDTH}px`} />

        <div class="play_icon">
            <PlayCircleOutline class="play" size="3rem" color={ColourVars.textPrimary} />
        </div>

        <div class="duration">
            <VideoOutline size="1rem" color={ColourVars.textPrimary} />
            <ChatFootnote>{videoDuration ?? "--:--"}</ChatFootnote>
        </div>
    </div>
    {@render textContent?.()}
{/snippet}

<MessageRenderer
    {replyView}
    {draftView}
    {regularView}
    caption={content.caption}
    maxCaptionWidth={!reply && !draft ? posterWidth : undefined}
    {fill}
    {me}
    {reply}
    {draft}
    {edited}
    {blockLevelMarkdown}
    {onRemove} />

<style lang="scss">
    .video_regular {
        display: flex;
        position: relative;

        .preview_img {
            width: 100%;
            background-color: black;
            border-radius: var(--rad-lg) var(--rad-lg) var(--rad-md) var(--rad-md);

            &.me {
                border-top-right-radius: var(--rad-sm);

                &.fill {
                    border-bottom-left-radius: var(--rad-lg);
                    border-bottom-right-radius: var(--rad-lg);
                }
            }

            &:not(.me) {
                border-top-left-radius: var(--rad-sm);

                &:not(.fill) {
                    border-bottom-right-radius: var(--rad-md);
                    border-bottom-left-radius: var(--rad-md);
                }
            }

            &:not(.landscape) {
                min-height: 6rem;
                min-width: 0;
            }
        }

        .play_icon {
            padding: var(--sp-md);
        }

        .duration {
            position: absolute;
            bottom: var(--sp-xxs);
            left: var(--sp-sm);
            display: flex;
            gap: var(--sp-xs);
            align-items: center;
            height: 0.75rem;
        }
    }

    .video_draft {
        width: 100%;
        padding: var(--sp-xs);
        animation: grow-height 300ms ease-out forwards;
        will-change: max-height, opacity;

        .video_wrapper {
            min-height: 4rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: var(--sp-xs);
            background-color: var(--background-0);
            border-radius: var(--rad-lg) var(--rad-lg) var(--rad-lg) var(--rad-lg);
        }

        .video {
            display: flex;
            width: 100%;
            max-height: 14rem;
            overflow: hidden;
            border-radius: var(--rad-md);
        }
    }

    :global {
        .video_regular .play_icon,
        .reply_image_preview .play_icon {
            position: absolute;
            display: flex;
            top: 50%;
            left: 50%;
            border-radius: var(--rad-circle);
            transform: translate(-50%, -50%);
            // background: rgba(50, 50, 50, 0.5);
            background: radial-gradient(
                circle,
                rgba(50, 50, 50, 0.75) 0%,
                rgba(50, 50, 50, 0.5) 50%,
                rgba(50, 50, 50, 0) 75%
            );
        }

        .video_regular {
            // Same CSS is set for message metadata
            .duration {
                text-shadow: 0 0 0.125rem var(--backdrop);

                path {
                    filter: drop-shadow(0 0 0.125rem var(--background-0));
                }
            }
        }

        .reply_image_preview {
            position: relative;
            height: -webkit-fill-available;

            .img {
                width: 4rem;
                min-height: 3rem;
                height: 100%;
                background-size: cover;
                background-position: top;
                border-radius: var(--rad-sm);
                filter: contrast(1.1) brightness(1.05) saturate(1.1);
            }
        }
    }
</style>
