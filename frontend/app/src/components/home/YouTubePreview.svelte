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
    let play = $state(false);

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
        {#if play}
            <iframe
                loading="lazy"
                class:pinned
                class:fill
                width="100%"
                height="315"
                src={`https://www.youtube.com/embed/${youtubeCode}?autoplay=1&start=${youtubeStartTime}`}
                title="YouTube video player"
                frameborder="0"
                allow="accelerometer;
                            autoplay;
                            clipboard-write;
                            encrypted-media;
                            gyroscope;
                            picture-in-picture"
                allowfullscreen></iframe>
        {:else}
            <div class="img-wrapper">
                <img
                    class="image"
                    loading="lazy"
                    width="100%"
                    class:pinned
                    class:fill
                    src={`https://img.youtube.com/vi/${youtubeCode}/hqdefault.jpg`}
                    alt="Video thumbnail" />
                <button aria-label="Play" onclick={() => (play = true)} class="play"></button>
            </div>
        {/if}
    </div>
{/if}

<style lang="scss">
    .img-wrapper {
        position: relative;
    }

    .play {
        cursor: pointer;
        background: none;
        border: none;
        width: toRem(100);
        aspect-ratio: 1 / 1;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-image: url(/assets/youtube_play.svg);
        background-repeat: no-repeat;
    }

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
