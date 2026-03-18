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
        showPreviews = true,
    }: Props = $props();

    let imgElement: HTMLImageElement | undefined = $state();
    let landscape = $derived(content.height < content.width);
    let normalised = $derived(normaliseContent(content));
    let hidden = $state(false);
    let zoomable = $derived(!draft && !reply && !pinned);
    let textContent = $derived<TextContentType | undefined>(
        normalised ? { kind: "text_content", text: normalised.caption ?? "" } : undefined,
    );

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
        width={"hug"}>
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
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <img
            bind:this={imgElement}
            onclick={focusImage}
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

        {#if !zoomable}
            <div class="status_icon" class:rtl={$rtlStore}>
                <EyeOffOutline size={"1.25em"} color={ColourVars.textPrimary} />
            </div>
        {/if}
    </Column>
{/if}

{#if textContent?.text}
    <TextContent content={textContent} {me} {fill} {blockLevelMarkdown} {edited} {showPreviews} />
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

            .image,
            .image_content_mask {
                border-radius: var(--rad-lg) var(--rad-lg) var(--rad-md) var(--rad-md) !important;
            }

            &.me {
                .image,
                .image_content_mask {
                    border-top-right-radius: var(--rad-sm) !important;
                }
            }

            &:not(.me) {
                .image,
                .image_content_mask {
                    border-top-left-radius: var(--rad-sm) !important;
                }
            }

            &.fill {
                .image,
                .image_content_mask {
                    border-bottom-left-radius: var(--rad-lg) !important;
                    border-bottom-right-radius: var(--rad-lg) !important;
                }
            }
        }
    }

    $radius: $sp3;

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
