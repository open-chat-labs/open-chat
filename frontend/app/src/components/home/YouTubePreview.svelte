<script lang="ts">
    import { offlineStore, ui } from "openchat-client";

    interface Props {
        pinned: boolean;
        fill: boolean;
        youtubeMatch: RegExpMatchArray;
        intersecting: boolean;
    }

    let { pinned, fill, youtubeMatch, intersecting }: Props = $props();
    let rendered = $state(false);

    $effect(() => {
        if (intersecting && !ui.eventListScrolling && !rendered && !$offlineStore) {
            rendered = true;
        }
    });

    let youtubeCode = $derived(
        youtubeMatch && (youtubeMatch[1] ?? youtubeMatch[2] ?? youtubeMatch[3])?.split("?")[0],
    );
    let youtubeStartTime = $derived(
        youtubeMatch ? new URL(youtubeMatch[0]).searchParams.get("t") || "0" : "0",
    );
</script>

{#if rendered}
    <div>
        <iframe
            class:pinned
            class:fill
            width="100%"
            height="315"
            src={`https://www.youtube.com/embed/${youtubeCode}?start=${youtubeStartTime}`}
            title="YouTube video player"
            frameborder="0"
            allow="accelerometer;
                            autoplay;
                            clipboard-write;
                            encrypted-media;
                            gyroscope;
                            picture-in-picture"
            allowfullscreen></iframe>
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
