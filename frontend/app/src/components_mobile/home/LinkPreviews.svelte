<script lang="ts">
    import { rtlStore } from "@src/stores/rtl";
    import { ColourVars } from "component-lib";
    import type { OgPreview, RehydratedMessagePreview, TwitchEmbed } from "@shared";
    import CloseIcon from "svelte-material-icons/Close.svelte";
    import GenericPreviewComponent from "./GenericPreview.svelte";
    import MessagePreviewComponent from "./MessagePreview.svelte";
    import TwitchPlayer from "./TwitchPlayer.svelte";

    interface Props {
        messagePreviews: RehydratedMessagePreview[];
        intersecting: boolean;
        me: boolean;
        onRemove?: (url: string) => void;
        ogPreviews: OgPreview[];
        twitchEmbeds: TwitchEmbed[];
    }

    let { messagePreviews, intersecting, me, onRemove, ogPreviews = [], twitchEmbeds }: Props =
        $props();

    // A Twitch link's player takes the place of its preview, which it shows on its poster
    let playerUrls = $derived(new Set(twitchEmbeds.map((e) => e.url)));

    const rtl = $rtlStore;

    function removePreview(url: string) {
        onRemove?.(url);
    }
</script>

{#snippet remove(url: string)}
    {#if me && onRemove}
        <div class="remove_wrapper" class:rtl>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="remove" onclick={() => removePreview(url)}>
                <CloseIcon viewBox="0 0 24 24" size="1.25rem" color={ColourVars.primaryAccent} />
            </div>
        </div>
    {/if}
{/snippet}

{#each messagePreviews as p (p.url)}
    <div class="preview" class:me>
        <div class="inner" class:me>
            <MessagePreviewComponent preview={p} {me} {intersecting} />
        </div>
    </div>
{/each}
{#each twitchEmbeds as e (e.url)}
    <div class="preview" class:me>
        <div class="inner" class:me>
            <TwitchPlayer {me} embed={e} ogPreview={ogPreviews.find((p) => p.url === e.url)} />
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
            background-color: var(--primary-surface);

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
