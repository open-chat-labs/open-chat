<script lang="ts">
    import { classifyUrl, extractUrls, iconSize, type LinkPreview } from "openchat-client";
    import type { OgPreview } from "openchat-shared";
    import CloseIcon from "svelte-material-icons/Close.svelte";
    import { rtlStore } from "../../stores/rtl";
    import GenericPreviewComponent from "./GenericPreview.svelte";
    import MessagePreviewComponent from "./MessagePreview.svelte";

    interface Props {
        text: string;
        ogPreviews: OgPreview[];
        intersecting: boolean;
        pinned: boolean;
        fill: boolean;
        me: boolean;
        onRemove?: (url: string) => void;
    }

    let { text, ogPreviews, intersecting, me, onRemove }: Props = $props();

    let ogPreviewMap = $derived(new Map(ogPreviews.map((p) => [p.url, p])));

    let urls = $derived<LinkPreview[]>(
        extractUrls(text).map((url) => {
            return ogPreviewMap.get(url) ?? classifyUrl(url);
        }),
    );

    let rtl = $rtlStore;

    function removePreview(preview: LinkPreview | undefined) {
        if (preview) {
            onRemove?.(preview.url);
        }
    }
</script>

{#each urls as p (p.url)}
    <div class="preview" class:visible={p.kind !== "generic" && p.kind !== "message"} class:me>
        {#if me}
            <div class="remove-wrapper" class:rtl>
                <div class="remove" onclick={() => removePreview(p)}>
                    <CloseIcon viewBox="0 0 24 24" size={$iconSize} color={"var(--button-txt)"} />
                </div>
            </div>
        {/if}
        <div class="inner" class:me>
            {#if p.kind === "message"}
                <MessagePreviewComponent
                    url={p.url}
                    chatId={p.chatId}
                    threadRootMessageIndex={p.threadRootMessageIndex}
                    messageIndex={p.messageIndex}
                    {intersecting} />
            {:else if p.kind === "opengraph"}
                <GenericPreviewComponent {me} ogPreview={p} />
            {/if}
        </div>
    </div>
{/each}

<style lang="scss">
    .preview {
        display: none;
        margin-top: $sp4;
        border-color: var(--currentChat-msg-separator);
        flex-direction: row-reverse;
        word-break: break-word;

        &.me {
            border-color: var(--currentChat-msg-me-separator);
        }

        &.visible {
            display: flex;
        }

        .remove-wrapper {
            flex: 0;
            position: relative;
            left: 6px;
            visibility: hidden;

            &.rtl {
                right: 6px;
                left: unset;
            }
        }

        .remove {
            cursor: pointer;
            display: flex;
        }

        .inner {
            flex: 1;
            min-width: 0; // prevent flex item expanding beyond available space
            overflow: hidden;

            &.me {
                border-color: var(--currentChat-msg-me-separator);
            }
        }
    }

    .preview:hover .remove-wrapper {
        visibility: visible;
    }
</style>
