<script lang="ts">
    import { iconSize } from "@client";
    import type { OgPreview, RehydratedMessagePreview, TwitchEmbed } from "@shared";
    import CloseIcon from "svelte-material-icons/Close.svelte";
    import { rtlStore } from "../../stores/rtl";
    import GenericPreviewComponent from "./GenericPreview.svelte";
    import MessagePreviewComponent from "./MessagePreview.svelte";
    import TwitchPlayer from "./TwitchPlayer.svelte";

    interface Props {
        messagePreviews: RehydratedMessagePreview[];
        ogPreviews: OgPreview[];
        twitchEmbeds: TwitchEmbed[];
        intersecting: boolean;
        pinned: boolean;
        fill: boolean;
        me: boolean;
        onRemove?: (url: string) => void;
    }

    let { messagePreviews, ogPreviews, twitchEmbeds, intersecting, me, onRemove }: Props = $props();

    // A Twitch link's player takes the place of its preview, which it shows on its poster
    let playerUrls = $derived(new Set(twitchEmbeds.map((e) => e.url)));

    const rtl = $rtlStore;

    function removePreview(url: string) {
        onRemove?.(url);
    }
</script>

{#snippet remove(url: string)}
    {#if me && onRemove}
        <div class="remove-wrapper" class:rtl>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="remove" onclick={() => removePreview(url)}>
                <CloseIcon viewBox="0 0 24 24" size={$iconSize} color={"var(--button-txt)"} />
            </div>
        </div>
    {/if}
{/snippet}

{#each messagePreviews as p (p.url)}
    <div class="preview" class:me>
        <div class="inner" class:me>
            <MessagePreviewComponent preview={p} {intersecting} />
        </div>
    </div>
{/each}
{#each twitchEmbeds as e (e.url)}
    <div class="preview" class:me>
        <div class="inner" class:me>
            <TwitchPlayer embed={e} ogPreview={ogPreviews.find((p) => p.url === e.url)} />
        </div>
    </div>
{/each}
{#each ogPreviews.filter((p) => !playerUrls.has(p.url)) as p (p.url)}
    <div class="preview" class:me>
        {@render remove(p.url)}
        <div class="inner" class:me>
            <GenericPreviewComponent {me} ogPreview={p} />
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
