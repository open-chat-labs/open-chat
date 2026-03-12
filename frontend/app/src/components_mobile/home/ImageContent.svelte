<script lang="ts">
    import { Button, ColourVars, Column, IconButton } from "component-lib";
    import { publish, type ImageContent, type MemeFighterContent } from "openchat-client";
    import Close from "svelte-material-icons/Close.svelte";
    import EyeOffOutline from "svelte-material-icons/EyeOffOutline.svelte";
    import FileHidden from "svelte-material-icons/FileHidden.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { rtlStore } from "../../stores/rtl";
    import { lowBandwidth } from "../../stores/settings";
    // import { isTouchDevice } from "../../utils/devices";
    import Translatable from "../Translatable.svelte";
    import ContentCaption from "./ContentCaption.svelte";
    import { scrollStatus } from "@stores/scroll.svelte";

    interface Props {
        content: ImageContent | MemeFighterContent;
        fill: boolean;
        draft?: boolean;
        reply?: boolean;
        pinned?: boolean;
        height?: number | undefined;
        intersecting?: boolean;
        edited: boolean;
        blockLevelMarkdown?: boolean;
        onRemove?: () => void;
    }

    let {
        content,
        fill,
        draft = false,
        reply = false,
        pinned = false,
        height = undefined,
        intersecting = true,
        edited,
        blockLevelMarkdown = false,
        onRemove,
    }: Props = $props();

    let imgElement: HTMLImageElement | undefined = $state();
    let landscape = $derived(content.height < content.width);

    function normaliseContent(content: ImageContent | MemeFighterContent) {
        switch (content.kind) {
            case "image_content":
                return {
                    url: content.blobUrl,
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

    let normalised = $derived(normaliseContent(content));
    let hidden = $state(false);
    $effect(() => {
        hidden = $lowBandwidth && !draft;
    });
    let zoomable = $derived(!draft && !reply && !pinned);

    function onError() {
        if (imgElement) {
            imgElement.src = normalised.fallback;
        }
    }
</script>

{#if normalised.url !== undefined}
    <Column maxWidth={"100%"} width={"hug"}>
        {#if hidden}
            <Column
                height={"fill"}
                padding={"xl"}
                supplementalClass={"image_content_mask"}
                mainAxisAlignment={"center"}
                crossAxisAlignment={"center"}>
                {#if !reply && !draft}
                    <Button height={"hug"} width={"fill"} onClick={() => (hidden = false)}
                        ><Translatable resourceKey={i18nKey(normalised.loadMsg)} /></Button>
                {/if}
            </Column>
        {/if}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <img
            bind:this={imgElement}
            onclick={focusImage}
            onerror={onError}
            class="unzoomed"
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
                <EyeOffOutline size={"1.75em"} color={ColourVars.textPrimary} />
            </div>
        {:else if hidden}
            <div class="status_icon" class:rtl={$rtlStore}>
                <FileHidden size={"1.75em"} color={ColourVars.textPrimary} />
            </div>
        {/if}
        {#if draft}
            <div class="close">
                <IconButton mode={"dark"} onclick={onRemove}>
                    {#snippet icon()}
                        <Close color={ColourVars.textPrimary} />
                    {/snippet}
                </IconButton>
            </div>
        {/if}
    </Column>
{/if}

<Column padding={["zero", "sm"]}>
    <ContentCaption caption={normalised.caption} {edited} {blockLevelMarkdown} />
</Column>

<style lang="scss">
    :global(.container.image_content_mask) {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        width: 100%;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        background: linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.5));
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

    img.unzoomed {
        width: 100%;
        display: block;
        border-radius: var(--rad-sm) var(--rad-sm) var(--rad-md) var(--rad-md);
        &:not(.rtl) {
            border-top-left-radius: var(--rad-lg);
        }

        &.rtl {
            border-top-right-radius: var(--rad-lg);
        }

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
