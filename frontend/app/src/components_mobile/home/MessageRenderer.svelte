<script lang="ts">
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import { type Snippet } from "svelte";
    import { ColourVars, IconButton } from "component-lib";
    import type { TextContent as TextContentType } from "openchat-client";
    import TextContent from "./TextContent.svelte";
    import Close from "svelte-material-icons/Close.svelte";

    interface Props {
        draftView: Snippet<[Snippet?]>;
        replyView: Snippet<[Snippet?]>;
        regularView: Snippet<[Snippet?]>;
        caption?: string;
        draft?: boolean;
        reply?: boolean;
        me?: boolean;
        edited?: boolean;
        fill?: boolean;
        blockLevelMarkdown?: boolean;
        showPreviews?: boolean;
        maxCaptionWidth?: number;
        onRemove?: () => void;
    }

    let {
        draftView,
        replyView,
        regularView,
        caption,
        reply = false,
        draft = false,
        me = false,
        edited = false,
        fill = false,
        blockLevelMarkdown = false,
        showPreviews = false,
        maxCaptionWidth,
        onRemove,
    }: Props = $props();

    // Messages are viewed in one of these three modes:
    // - draft  - User has just started with this message
    // - reply  - Render this message vith a reply view, user is just replying
    //            to this message, or has already replied; reply view is more
    //            often more concise than a rendered/regular view!
    // - render - Render a regular view for this message
    type RendererMode = "draft" | "reply" | "render";

    let mode = $derived<RendererMode>(reply ? "reply" : draft ? "draft" : "render");

    let textContent = $derived<TextContentType | undefined>(
        !!caption ? { kind: "text_content", text: caption ?? "" } : undefined,
    );
    let textContentArg = $derived(!!textContent?.text ? captionRenderer : undefined);
</script>

{#snippet captionRenderer()}
    {#if textContent?.text}
        <TextContent
            content={textContent}
            {me}
            {reply}
            {fill}
            {blockLevelMarkdown}
            {edited}
            {showPreviews}
            maxWidth={maxCaptionWidth}
            isPreview={draft || reply} />
    {/if}
{/snippet}

{#if mode === "reply"}
    {@render replyView(textContentArg)}
{:else if mode === "draft"}
    {@render draftView(textContentArg)}
    <div class="close" class:rtl={$rtlStore}>
        <IconButton size="sm" mode={"dark"} onclick={onRemove}>
            {#snippet icon()}
                <Close color={ColourVars.textPrimary} />
            {/snippet}
        </IconButton>
    </div>
{:else}
    {@render regularView(textContentArg)}
{/if}

<style lang="scss">
    .close {
        position: absolute;
        top: var(--sp-xs);
        right: var(--sp-xs);
    }
</style>
