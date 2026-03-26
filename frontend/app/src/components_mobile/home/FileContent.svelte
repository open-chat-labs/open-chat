<script lang="ts">
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import { getContext, type Snippet } from "svelte";
    import {
        Body,
        BodySmall,
        ChatCaption,
        ColourVars,
        Column,
        IconButton,
        Row,
        type Padding,
        type Radius,
    } from "component-lib";
    import type { FileContent, OpenChat, TextContent as TextContentType } from "openchat-client";
    import { mimeTypeToHumanReadable } from "openchat-client";
    import TextContent from "./TextContent.svelte";
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

    let textContent = $derived<TextContentType | undefined>(
        !!content.caption ? { kind: "text_content", text: content.caption ?? "" } : undefined,
    );
    let hasContent = $derived(!!textContent?.text);
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
            <Body>{content.name}</Body>
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

{#snippet fileReplyView()}
    <Column gap={hasContent ? "zero" : "xs"}>
        {@render title?.()}
        {@render fileTextContent()}
        <Row gap="xs" crossAxisAlignment="center" padding={["zero", "xxs", "zero", "zero"]}>
            {#if hasContent}
                {@const textColor = me ? "secondary" : "primary"}
                <FileUploadOutline size="1rem" color={ColourVars[textColor]} />
                <ChatCaption fontWeight="semi-bold" colour={textColor}>{content.name}</ChatCaption>
            {:else}
                {@const textColor = me ? "secondaryLight" : "primaryLight"}
                <FileUploadOutline size="1rem" color={ColourVars[textColor]} />
                <BodySmall fontWeight="semi-bold" colour={textColor}>
                    {content.name}
                </BodySmall>
            {/if}
        </Row>
    </Column>
{/snippet}

{#snippet fileTextContent()}
    {#if textContent?.text}
        <TextContent
            content={textContent}
            {me}
            {reply}
            fill={false}
            {blockLevelMarkdown}
            {edited}
            showPreviews={false}
            isPreview={draft || reply} />
    {/if}
{/snippet}

{#if reply}
    <!-- User is replying to a message with file attached, and it's still in draft-->
    <!-- User has replied to a file content message, and we're rendering the message -->
    {@render fileReplyView()}
{:else if draft}
    <!-- User is sending a new file, and it's still in draft -->
    <Column padding="xs">
        <Column
            supplementalClass="file_draft_contents"
            backgroundColor={ColourVars.background0}
            borderRadius="lg">
            {@render fileContent("zero", "background1")}
            {@render fileTextContent()}
        </Column>
    </Column>
    <div class="close" class:rtl={$rtlStore}>
        <IconButton size="sm" mode={"dark"} onclick={onRemove}>
            {#snippet icon()}
                <Close color={ColourVars.textPrimary} />
            {/snippet}
        </IconButton>
    </div>
{:else}
    <!-- User has sent a message with file attached, and we're rendering the message -->
    {@const borderRadius: Radius = [me ? "lg" : "md", me ? "md" : "lg", "md", "md"]}
    {@const backgroundColor = me ? ColourVars.primaryMuted : ColourVars.background1}
    {#if content.blobUrl}
        <a
            href={content.blobUrl}
            title={$_("downloadFile", { values: { name: content.name } })}
            download={content.name}
            role="button"
            target="_blank"
            class:rtl={$rtlStore}
            class:draft
            class:no_content={!reply && !textContent?.text}
            class="file_content">
            {@render fileContent(borderRadius, backgroundColor, ["sm", "md"])}
        </a>
        {@render fileTextContent()}
    {/if}
{/if}

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
