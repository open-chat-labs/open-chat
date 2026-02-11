<script lang="ts">
    import {
        BodySmall,
        Button,
        ColourVars,
        Column,
        IconButton,
        Row,
        Subtitle,
    } from "component-lib";
    import { type GiphyContent } from "openchat-client";
    import Close from "svelte-material-icons/Close.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { rtlStore } from "../../stores/rtl";
    import { lowBandwidth } from "../../stores/settings";
    import Translatable from "../Translatable.svelte";
    import ContentCaption from "./ContentCaption.svelte";

    interface Props {
        content: GiphyContent;
        fill: boolean;
        draft?: boolean;
        reply?: boolean;
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
        height = undefined,
        intersecting = true,
        edited,
        blockLevelMarkdown = false,
        onRemove,
    }: Props = $props();

    let withCaption = $derived(content.caption !== undefined && content.caption !== "");
    let image = $derived(content.mobile);
    let landscape = $derived(image.height < image.width);
    let style = $derived(
        `${height === undefined ? "" : `height: ${height}px;`} max-width: ${image.width}px;`,
    );

    let hidden = $derived($lowBandwidth);
</script>

{#if draft}
    <Row
        gap={"lg"}
        crossAxisAlignment={"center"}
        padding={["sm", "lg", "sm", "sm"]}
        borderRadius={"lg"}
        background={ColourVars.background1}>
        <img class={"thumb"} src={content.mobile.url} alt={content.caption ?? content.title} />
        <Column>
            <Subtitle ellipsisTruncate fontWeight={"bold"}>
                {content.title}
            </Subtitle>
            <BodySmall colour={"textSecondary"}>
                <Translatable resourceKey={i18nKey("Sharing a GIF")} />
            </BodySmall>
        </Column>
        <IconButton onclick={onRemove}>
            {#snippet icon()}
                <Close color={ColourVars.textSecondary} />
            {/snippet}
        </IconButton>
    </Row>
{:else}
    <div class="img-wrapper">
        {#if !intersecting}
            <div
                class="placeholder"
                class:landscape
                class:fill
                class:withCaption
                {style}
                class:draft
                title={content.caption ?? content.title}
                class:reply
                class:rtl={$rtlStore}>
            </div>
        {:else if hidden}
            <Column
                height={"fill"}
                padding={"xl"}
                supplementalClass={"image_content_mask"}
                mainAxisAlignment={"center"}
                crossAxisAlignment={"center"}>
                {#if !reply && !draft}
                    <Button height={"hug"} width={"fill"} onClick={() => (hidden = false)}
                        ><Translatable resourceKey={i18nKey("loadGif")} /></Button>
                {/if}
            </Column>
            <img
                class:landscape
                class:fill
                class:withCaption
                class:draft
                class:reply
                class:rtl={$rtlStore}
                {style}
                src={content.mobile.url}
                alt={content.caption ?? content.title} />
        {:else}
            <video
                autoplay
                muted
                loop
                playsinline
                class:landscape
                class:fill
                class:withCaption
                class:draft
                class:reply
                class:rtl={$rtlStore}
                title={content.caption ?? content.title}
                {style}>
                <track kind="captions" />
                <source src={content.desktop.url} type="video/mp4" />
            </video>
        {/if}
    </div>

    <ContentCaption caption={content.caption} {edited} {blockLevelMarkdown} />
{/if}

<style lang="scss">
    .img-wrapper {
        position: relative;
    }

    .mask {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        width: 100%;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        background: linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.5));
    }

    .reveal {
        position: absolute;
        top: calc(50% - 20px);
        width: 100%;
        text-align: center;
    }

    .placeholder,
    img,
    video {
        width: 100%;
        display: block;

        &:not(.landscape) {
            min-height: 90px;
            min-width: 0px;
        }

        &:not(.fill) {
            border-radius: $sp4;
        }

        &.withCaption {
            margin-bottom: $sp2;
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
            height: 100%;
        }

        &.reply {
            max-width: 90px;
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
            max-height: 90px;
            width: auto;
        }
    }

    .thumb {
        width: 5rem;
        height: 5rem;
        min-height: 5rem !important;
        flex: 0 0 5rem;
        aspect-ratio: 1 / 1;
        object-fit: cover;
    }
</style>
