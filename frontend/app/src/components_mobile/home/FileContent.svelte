<script lang="ts">
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import { getContext, type Snippet } from "svelte";
    import {
        Body,
        BodySmall,
        ColourVars,
        Column,
        IconButton,
        Row,
        type Padding,
        type Radius,
    } from "component-lib";
    import type { FileContent, OpenChat, TextContent as TextContentType } from "openchat-client";
    import { mimeTypeToHumanReadable } from "openchat-client";
    import { getProxyAdjustedBlobUrl } from "../../utils/media";
    import MessageRenderer from "./MessageRenderer.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import FileUploadOutline from "svelte-material-icons/FileUploadOutline.svelte";

    const client = getContext<OpenChat>("client");
    const BULL = "\u2022";

    interface Props {
        content: FileContent;
        title?: Snippet;
        me?: boolean;
        draft?: boolean;
        edited: boolean;
        reply?: boolean;
        onRemove?: () => void;
        blockLevelMarkdown?: boolean;
    }

    let {
        content,
        title,
        me = false,
        draft = false,
        edited,
        reply = false,
        blockLevelMarkdown = false,
        onRemove,
    }: Props = $props();

    let normalisedContent = $derived<TextContentType | undefined>(
        !!content.caption ? { kind: "text_content", text: content.caption ?? "" } : undefined,
    );
</script>

{#snippet fileContent(borderRadius: Radius, backgroundColor: string, padding?: Padding)}
    {@const subtextColour = me && reply ? "secondaryLight" : "primaryLight"}
    <Column
        supplementalClass="link_contents"
        padding={padding ?? "sm"}
        gap="xs"
        {borderRadius}
        {backgroundColor}>
        <Row>
            <Body fontWeight="semi-bold">{content.name}</Body>
        </Row>
        <Row crossAxisAlignment="center" gap="xs">
            <FileUploadOutline size="1rem" color={ColourVars[subtextColour]} />
            <BodySmall width="hug" colour={subtextColour}>
                {mimeTypeToHumanReadable(content.mimeType)}
                {BULL}
                {client.formatFileSize(content.fileSize)}
            </BodySmall>
        </Row>
    </Column>
{/snippet}

{#snippet replyView(textContent?: Snippet)}
    <Column>
        {@render title?.()}
        <Row gap="xs" crossAxisAlignment="center" padding={["xs", "xxs", "xxs", "zero"]}>
            {@const textColor = me ? "secondary" : "primary"}
            <FileUploadOutline size="1rem" color={ColourVars[textColor]} />
            <Body fontWeight="semi-bold" colour={textColor}>
                {content.name}
            </Body>
        </Row>
        {@render textContent?.()}
    </Column>
{/snippet}

{#snippet draftView(textContent?: Snippet)}
    <!-- User is sending a new file, and it's still in draft -->
    <Column padding="xs">
        <Column
            supplementalClass="file_draft_contents"
            backgroundColor={ColourVars.background0}
            borderRadius="lg">
            {@render fileContent("zero", "background1")}
            {@render textContent?.()}
        </Column>
    </Column>
    <div class="close" class:rtl={$rtlStore}>
        <IconButton size="sm" mode={"dark"} onclick={onRemove}>
            {#snippet icon()}
                <Close color={ColourVars.textPrimary} />
            {/snippet}
        </IconButton>
    </div>
{/snippet}

{#snippet regularView(textContent?: Snippet)}
    <!-- User has sent a message with file attached, and we're rendering the message -->
    {@const borderRadius: Radius = [me ? "lg" : "md", me ? "md" : "lg", "md", "md"]}
    {@const backgroundColor = me ? ColourVars.primaryMuted : ColourVars.background1}
    {#if content.blobUrl}
        <a
            href={getProxyAdjustedBlobUrl(content.blobUrl)}
            title={$_("downloadFile", { values: { name: content.name } })}
            download={content.name}
            role="button"
            target="_blank"
            class:rtl={$rtlStore}
            class:draft
            class:no_content={!reply && !textContent}
            class="file_content">
            {@render fileContent(borderRadius, backgroundColor, ["sm", "md"])}
        </a>
        {@render textContent?.()}
    {/if}
{/snippet}

<MessageRenderer
    {replyView}
    {draftView}
    {regularView}
    caption={normalisedContent?.text}
    {me}
    {reply}
    {draft}
    {edited}
    {blockLevelMarkdown}
    {onRemove} />

<style lang="scss">
    :global(.file_draft_contents) {
        // TODO apply this to all attachment variants
        animation: grow-height 300ms ease-out forwards;
        will-change: max-height, opacity;
    }

    .file_content {
        display: block;
        width: 100%;

        &.no_content {
            padding-bottom: 1.125rem;
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
