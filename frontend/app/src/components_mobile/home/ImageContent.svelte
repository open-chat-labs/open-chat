<script lang="ts">
    import { ColourVars, Column, CommonButton2 } from "component-lib";
    import {
        publish,
        type ImageContent,
        type TextContent as TextContentType,
        type MemeFighterContent,
    } from "openchat-client";
    import EyeOffOutline from "svelte-material-icons/EyeOffOutline.svelte";
    import { rtlStore } from "../../stores/rtl";
    import { lowBandwidth } from "../../stores/settings";
    import { scrollStatus } from "@stores/scroll.svelte";
    import { getProxyAdjustedBlobUrl } from "../../utils/media";
    import EyeOutline from "svelte-material-icons/EyeOutline.svelte";
    import TextContent from "./TextContent.svelte";

    interface Props {
        content: ImageContent | MemeFighterContent;
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
        onRemovePreview,
    }: Props = $props();

    const MIN_IMG_WIDTH = 150;

    let imgElement: HTMLImageElement | undefined = $state();
    let landscape = $derived(content.height < content.width);
    let normalised = $derived(normaliseContent(content));
    let hidden = $state(false);
    let imageWidth = $state(0);
    let zoomable = $derived(!draft && !reply && !pinned);
    let textContent = $derived<TextContentType | undefined>(
        normalised ? { kind: "text_content", text: normalised.caption ?? "" } : undefined,
    );

    let narrow = $derived(imageWidth > 0 && imageWidth < MIN_IMG_WIDTH && !!textContent?.text);
    let maxTextContentWidth = $derived(narrow ? 200 : imageWidth);

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

{#if normalised.url !== undefined}
    <Column
        supplementalClass={`bubble_image_content ${me ? "me" : ""} ${fill ? "fill" : ""}`}
        maxWidth={"100%"}
        width={narrow ? "fill" : "hug"}>
        {#if hidden}
            <Column
                height={"fill"}
                supplementalClass={"image_content_mask"}
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
        </div>
        {#if !zoomable}
            <div class="status_icon" class:rtl={$rtlStore}>
                <EyeOffOutline size={"1.25em"} color={ColourVars.textPrimary} />
            </div>
        {/if}
    </Column>
{/if}

{#if textContent?.text}
    <TextContent
        content={textContent}
        {me}
        {fill}
        {blockLevelMarkdown}
        {edited}
        maxWidth={maxTextContentWidth}
        showPreviews={false}
        {onRemovePreview} />
{/if}

<style lang="scss">
    :global {
        .bubble_image_content {
            .image_content_mask {
                position: absolute;
                top: 0;
                left: 0;
                height: 100%;
                width: 100%;
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                background: linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.5));
            }

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
        }
    }

    $radius: $sp3;

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

    .close {
        position: absolute;
        top: var(--sp-md);
        right: var(--sp-md);
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
</style>
