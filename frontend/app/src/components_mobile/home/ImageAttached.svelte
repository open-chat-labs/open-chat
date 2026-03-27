<script lang="ts">
    import { Button, ColourVars, Column, IconButton } from "component-lib";
    import type { ImageContent, MemeFighterContent } from "openchat-client";
    import Close from "svelte-material-icons/Close.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { rtlStore } from "../../stores/rtl";
    import { lowBandwidth } from "../../stores/settings";
    import Translatable from "../Translatable.svelte";

    interface Props {
        content: ImageContent | MemeFighterContent;
        fill: boolean;
        draft?: boolean;
        reply?: boolean;
        pinned?: boolean;
        height?: number | undefined;
        intersecting?: boolean;
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
        onRemove,
    }: Props = $props();

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

    let normalised = $derived(normaliseContent(content));
    let hidden = $state(false);
    $effect(() => {
        hidden = $lowBandwidth && !draft;
    });
    let zoomable = $derived(!draft && !reply && !pinned);
</script>

{#if normalised.url !== undefined}
    <Column width={"fill"}>
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

        <div class="image_preview">
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

        <div class="close" class:rtl={$rtlStore}>
            <IconButton size="sm" onclick={onRemove}>
                {#snippet icon()}
                    <Close color={ColourVars.textPrimary} />
                {/snippet}
            </IconButton>
        </div>
    </Column>
{/if}

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

    .image_preview {
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

    .close {
        position: absolute;
        top: var(--sp-xs);

        &:not(.rtl) {
            right: var(--sp-xs);
        }

        &.rtl {
            left: var(--sp-xs);
        }
    }
</style>
