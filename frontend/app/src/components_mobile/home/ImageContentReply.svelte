<script lang="ts">
    import { Column, ChatCaption, ColourVars, Row } from "component-lib";
    import type { ImageContent, MemeFighterContent } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    // TODO RTL
    // import { rtlStore } from "../../stores/rtl";
    import { lowBandwidth } from "../../stores/settings";
    import Translatable from "../Translatable.svelte";
    import Markdown from "./Markdown.svelte";
    import ImageOutline from "svelte-material-icons/ImageOutline.svelte";
    import { type Snippet } from "svelte";

    interface Props {
        title: Snippet;
        content: ImageContent | MemeFighterContent;
        fill: boolean;
        draft?: boolean;
        reply?: boolean;
        pinned?: boolean;
        height?: number | undefined;
        intersecting?: boolean;
        blockLevelMarkdown?: boolean;
        me: boolean;
    }

    let {
        title,
        content,
        draft = false,
        pinned = false,
        intersecting = true,
        blockLevelMarkdown = false,
        me = false,
    }: Props = $props();

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
</script>

<Row gap="sm">
    <Column width="fill" gap="xxs" padding={["xs", "zero"]}>
        {@render title()}
        {#if normalised.caption}
            <ChatCaption
                width={"fill"}
                colour={me ? "secondaryLight" : "primaryLight"}
                maxLines={3}>
                <Markdown
                    inline={!blockLevelMarkdown}
                    suppressLinks={pinned}
                    text={normalised.caption} />
            </ChatCaption>
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
        class="image_preview"
        style="background-image:url({intersecting && !hidden
            ? normalised.url
            : normalised.fallback});">
    </div>
</Row>

<style lang="scss">
    .image_preview {
        width: 30%;
        height: -webkit-fill-available;
        background-size: cover;
        background-position: center;
        border-radius: var(--rad-sm);
        border-top-right-radius: var(--rad-lg);
    }
</style>
