<script lang="ts">
    import { type Snippet } from "svelte";
    import { Button, ChatCaption, ColourVars, Column, CommonButton2, Row } from "component-lib";
    import {
        publish,
        type ImageContent,
        type TextContent as TextContentType,
        type MemeFighterContent,
    } from "openchat-client";
    import { rtlStore } from "../../stores/rtl";
    import { lowBandwidth } from "../../stores/settings";
    import { scrollStatus } from "@stores/scroll.svelte";
    import { getProxyAdjustedBlobUrl } from "../../utils/media";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import MessageRenderer from "./MessageRenderer.svelte";
    import EyeOutline from "svelte-material-icons/EyeOutline.svelte";
    import EyeOffOutline from "svelte-material-icons/EyeOffOutline.svelte";
    import ImageOutline from "svelte-material-icons/ImageOutline.svelte";

    interface Props {
        content: ImageContent | MemeFighterContent;
        contentWidth?: number;
        title?: Snippet;
        me: boolean;
        fill: boolean;
        draft?: boolean;
        reply?: boolean;
        pinned?: boolean;
        height?: number | undefined;
        intersecting?: boolean;
        edited: boolean;
        blockLevelMarkdown?: boolean;
        showPreviews?: boolean;
        onRemove?: () => void;
        onRemovePreview?: (url: string) => void;
    }

    let {
        content,
        contentWidth = $bindable(),
        title,
        me,
        fill,
        draft = false,
        reply = false,
        pinned = false,
        height = undefined,
        intersecting = true,
        edited,
        blockLevelMarkdown = false,
        // TODO Fix show previews! Currently if a preview is removed, it also removes the attached image!!!
        // showPreviews = true,
        // onRemovePreview,
        onRemove,
    }: Props = $props();

    const MIN_IMG_WIDTH = 150;

    let imgElement: HTMLImageElement | undefined = $state();
    let imageWidth = $state(0);
    let landscape = $derived(content.height < content.width);
    let normalised = $derived(normaliseContent(content));
    let hidden = $state(false);
    let zoomable = $derived(!draft && !reply && !pinned);
    let textContent = $derived<TextContentType | undefined>(
        normalised ? { kind: "text_content", text: normalised.caption ?? "" } : undefined,
    );
    let hasContent = $derived(!!textContent?.text);

    let narrow = $derived(imageWidth > 0 && imageWidth < MIN_IMG_WIDTH && hasContent);
    let maxTextContentWidth = $derived(narrow ? 200 : imageWidth);

    $effect(() => {
        contentWidth = maxTextContentWidth;
    });
    $effect(() => {
        hidden = $lowBandwidth && !draft;
    });

    function normaliseContent(content: ImageContent | MemeFighterContent) {
        switch (content.kind) {
            case "image_content":
                return {
                    url: getProxyAdjustedBlobUrl(content.blobUrl),
                    caption: content.caption,
                    fallback: content.thumbnailData,
                    loadMsg: "loadImage",
                };
            case "meme_fighter_content":
                return {
                    url: content.url,
                    caption: undefined,
                    fallback: "/assets/memefighter.svg",
                    loadMsg: "loadMeme",
                };
        }
    }

    function focusImage() {
        if (!scrollStatus.isCooldown) {
            publish("focusImage", content);
        }
    }

    function onError() {
        if (imgElement) {
            imgElement.src = normalised.fallback;
        }
    }
</script>

{#snippet replyView(textContent?: Snippet)}
    <Row gap="sm" minWidth="12rem">
        <Column width="fill" gap="xxs" padding={["xs", "zero"]}>
            {@render title?.()}
            {#if textContent}
                {@render textContent()}
            {:else}
                <Row gap="xs" crossAxisAlignment="center">
                    <ImageOutline
                        color={me ? ColourVars.secondaryLight : ColourVars.primaryLight}
                        size="1.25rem" />
                    <ChatCaption colour={me ? "secondaryLight" : "primaryLight"}>
                        <Translatable resourceKey={i18nKey("Photo")} />
                    </ChatCaption>
                </Row>
            {/if}
        </Column>
        <div
            class="reply_image_preview"
            style="background-image:url({intersecting && !hidden
                ? normalised.url
                : normalised.fallback});">
        </div>
    </Row>
{/snippet}

{#snippet draftView()}
    <Column width={"fill"}>
        {#if hidden}
            <Column
                height={"fill"}
                padding={"xl"}
                supplementalClass={"draft_image_content_mask"}
                mainAxisAlignment={"center"}
                crossAxisAlignment={"center"}>
                {#if !reply && !draft}
                    <Button height={"hug"} width={"fill"} onClick={() => (hidden = false)}
                        ><Translatable resourceKey={i18nKey(normalised.loadMsg)} /></Button>
                {/if}
            </Column>
        {/if}

        <div class="draft_image_preview">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <div class="image_wrapper">
                <img
                    class="img"
                    class:landscape
                    class:fill
                    class:draft
                    class:reply
                    class:zoomable={zoomable && !hidden}
                    class:rtl={$rtlStore}
                    style={height === undefined ? undefined : `height: ${height}px`}
                    src={intersecting && !hidden ? normalised.url : normalised.fallback}
                    alt={normalised.caption} />
            </div>
        </div>
    </Column>
{/snippet}

{#snippet regularView(textContent?: Snippet)}
    <Column
        supplementalClass={`regular_image_content ${me ? "me" : ""} ${fill ? "fill" : ""}`}
        maxWidth={"100%"}
        width={narrow ? "fill" : "hug"}>
        {#if hidden}
            <Column
                height={"fill"}
                supplementalClass={"regular_image_content_mask"}
                mainAxisAlignment={"center"}
                crossAxisAlignment={"center"}>
                {#if !reply && !draft}
                    <CommonButton2 onClick={() => (hidden = false)} variant="secondary" mode="text">
                        <EyeOutline size="2rem" color={ColourVars.textPrimary} />
                    </CommonButton2>
                {/if}
            </Column>
        {/if}
        <!-- svelte-ignore a11y_interactive_supports_focus -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="image_wrapper" class:narrow onclick={focusImage}>
            {#if normalised.url !== undefined}
                <img
                    bind:this={imgElement}
                    bind:clientWidth={imageWidth}
                    onerror={onError}
                    class="image"
                    class:me
                    class:landscape
                    class:fill
                    class:draft
                    class:reply
                    class:zoomable={zoomable && !hidden}
                    class:rtl={$rtlStore}
                    style={height === undefined ? undefined : `height: ${height}px`}
                    src={intersecting && !hidden ? normalised.url : normalised.fallback}
                    alt={normalised.caption} />
            {:else}
                <!-- TODO generic image preview -->
                <div></div>
            {/if}
        </div>
        {#if !zoomable}
            <div class="status_icon" class:rtl={$rtlStore}>
                <EyeOffOutline size={"1.25em"} color={ColourVars.textPrimary} />
            </div>
        {/if}
    </Column>
    {@render textContent?.()}
{/snippet}

<MessageRenderer
    {replyView}
    {draftView}
    {regularView}
    caption={textContent?.text}
    maxCaptionWidth={!reply && !draft ? maxTextContentWidth : undefined}
    {fill}
    {me}
    {reply}
    {draft}
    {edited}
    {blockLevelMarkdown}
    {onRemove} />

<style lang="scss">
    :global {
        .draft_image_content_mask,
        .regular_image_content_mask {
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            width: 100%;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            background: linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.5));
        }

        .regular_image_content {
            .image_wrapper,
            .image_content_mask {
                border-radius: var(--rad-lg) var(--rad-lg) var(--rad-md) var(--rad-md) !important;
            }

            &.me {
                .image_wrapper,
                .image_content_mask {
                    border-top-right-radius: var(--rad-sm) !important;
                }

                .image_wrapper.narrow {
                    background-color: var(--primary-muted);
                }
            }

            &:not(.me) {
                .image_wrapper,
                .image_content_mask {
                    border-top-left-radius: var(--rad-sm) !important;
                }

                .image_wrapper.narrow {
                    background-color: var(--background-1);
                }
            }

            &.fill {
                .image_wrapper,
                .image_content_mask {
                    border-bottom-left-radius: var(--rad-lg) !important;
                    border-bottom-right-radius: var(--rad-lg) !important;
                }
            }

            .image_wrapper {
                overflow: hidden;

                &.narrow {
                    width: 100%;
                    display: flex;
                    justify-content: center;
                    padding: var(--sp-xs);

                    .image {
                        border-radius: var(--rad-md);
                    }
                }
            }

            .image {
                width: 100%;
                display: block;

                &:not(.landscape) {
                    min-height: 6rem;
                    min-width: 0;
                }

                &.draft {
                    max-width: calc(var(--vh, 1vh) * 50);
                    max-height: none;
                    height: auto;
                }

                &:not(.landscape).draft {
                    max-width: none;
                    max-height: calc(var(--vh, 1vh) * 50);
                    width: auto;
                    width: -webkit-fill-available;
                    height: 100%;
                }

                &.reply {
                    max-width: 6rem;
                    max-height: none;
                    height: auto;
                    float: right;
                    margin-left: $sp3;
                    margin-right: 0;
                }

                &.rtl.reply {
                    float: left;
                    margin-left: 0;
                    margin-right: $sp3;
                }

                &:not(.landscape).reply {
                    max-width: none;
                    max-height: 6rem;
                    width: auto;
                }
            }

            .status_icon {
                position: absolute;
                bottom: var(--sp-xs);
                right: var(--sp-sm);

                &.rtl {
                    left: 0;
                    right: unset;
                }
            }
        }
    }

    .reply_image_preview {
        width: 4rem;
        min-height: 3rem;
        height: -webkit-fill-available;
        background-size: cover;
        background-position: center;
        border-radius: var(--rad-sm);
    }

    .draft_image_preview {
        width: 100%;
        padding: var(--sp-xs);
        animation: grow-height 300ms ease-out forwards;
        will-change: max-height, opacity;

        .image_wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: var(--sp-xs);
            background-color: var(--background-0);
            border-radius: var(--rad-lg) var(--rad-lg) var(--rad-lg) var(--rad-lg);
        }

        .img {
            display: flex;
            max-width: 14rem;
            max-height: 14rem;
            overflow: hidden;
            border-radius: var(--rad-md);
        }

        .img-bg {
            width: 10rem;
            height: 10rem;
            background-size: contain;
            background-repeat: no-repeat;
        }
    }
</style>
