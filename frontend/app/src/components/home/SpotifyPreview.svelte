<script lang="ts">
    import { offlineStore, ui } from "openchat-client";

    interface Props {
        pinned: boolean;
        fill: boolean;
        matches: RegExpMatchArray;
        intersecting: boolean;
    }

    let { pinned, fill, matches, intersecting }: Props = $props();

    function buildUrl(type: string, id: string) {
        return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator`;
    }
    let type = $derived(matches[1]);
    let id = $derived(matches[2]);
    let url = $derived(buildUrl(type, id));
    let rendered = $state(false);

    $effect(() => {
        if (intersecting && !ui.eventListScrolling && !rendered && !$offlineStore) {
            rendered = true;
        }
    });
</script>

{#if rendered}
    <div>
        <iframe
            class:pinned
            class:fill
            style="border-radius:12px"
            src={url}
            width="100%"
            height="352"
            frameBorder="0"
            title="Spotify player"
            allowfullscreen
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"></iframe>
    </div>
{/if}

<style lang="scss">
    iframe {
        margin-top: $sp3;
    }

    iframe:not(.fill) {
        border-radius: $sp3;
    }

    iframe.pinned {
        pointer-events: none;
    }
</style>
