<script lang="ts">
    import { rtlStore } from "@src/stores/rtl";
    import { ColourVars } from "component-lib";
    import { classifyUrl, extractUrls, type LinkPreview } from "openchat-client";
    import type { OgPreview } from "openchat-shared";
    import CloseIcon from "svelte-material-icons/Close.svelte";
    import GenericPreviewComponent from "./GenericPreview.svelte";
    import MessagePreviewComponent from "./MessagePreview.svelte";

    interface Props {
        text: string;
        intersecting: boolean;
        me: boolean;
        onRemove?: (url: string) => void;
        ogPreviews: OgPreview[];
    }

    let { text, intersecting, me, onRemove, ogPreviews = [] }: Props = $props();

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
            <div class="remove_wrapper" class:rtl>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="remove" onclick={() => removePreview(p)}>
                    <CloseIcon viewBox="0 0 24 24" size="1.25rem" color={ColourVars.primaryLight} />
                </div>
            </div>
        {/if}
        <div class="inner" class:me>
            {#if p.kind === "message"}
                <MessagePreviewComponent
                    url={p.url}
                    {me}
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
        word-break: break-word;
        flex-direction: row-reverse;
        overflow: hidden;
        border-radius: var(--rad-sm);

        .remove_wrapper {
            flex: 0;
            top: 0.35rem;
            right: 0.35rem;
            position: absolute;
            padding: var(--sp-xxs);
            border-radius: var(--rad-circle);
            background-color: var(--primary-muted);

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
            max-width: 100%;
            display: flex;
            min-width: 0; // prevent flex item expanding beyond available space
            overflow: hidden;
        }
    }

    :global {
        .container.message_bubble.no_header .intersection_observer:first-child > .preview {
            &.me {
                border-top-left-radius: var(--rad-lg);
            }

            &:not(.me) {
                border-top-right-radius: var(--rad-lg);
            }
        }
    }
</style>
