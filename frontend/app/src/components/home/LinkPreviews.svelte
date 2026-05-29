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
        extractUrls(text).reduce((urls, url) => {
            const u = ogPreviewMap.get(url) ?? classifyUrl(url);
            if (u !== undefined) {
                urls.push(u);
            }
            return urls;
        }, [] as LinkPreview[]),
    );

    let rtl = $rtlStore;

    function removePreview(preview: LinkPreview | undefined) {
        if (preview) {
            onRemove?.(preview.url);
        }
    }
</script>

{#each urls as p (p.url)}
    <div class="preview" class:me>
        {#if me && onRemove}
            <div class="remove-wrapper" class:rtl>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
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
        position: relative;
        margin-top: $sp4;
        border-color: var(--currentChat-msg-separator);
        flex-direction: row-reverse;
        word-break: break-word;

        &.me {
            border-color: var(--currentChat-msg-me-separator);
        }

        .remove-wrapper {
            flex: 0;
            top: 0.35rem;
            right: 0.35rem;
            position: absolute;
            padding: var(--sp-xxs);
            border-radius: var(--rad-circle);
            background-color: var(--currentChat-msg-me-bg);

            &.rtl {
                right: unset;
                left: 0.35rem;
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
