<script lang="ts">
    interface Props {
        pinned: boolean;
        fill: boolean;
        youtubeMatch: RegExpMatchArray;
    }

    let { pinned, fill, youtubeMatch }: Props = $props();

    let youtubeCode = $derived(
        youtubeMatch && (youtubeMatch[1] ?? youtubeMatch[2] ?? youtubeMatch[3])?.split("?")[0],
    );
    let youtubeStartTime = $derived(
        youtubeMatch ? new URL(youtubeMatch[0]).searchParams.get("t") || "0" : "0",
    );
</script>

<div>
    <iframe
        class:pinned
        class:fill
        width="100%"
        height="315"
        referrerpolicy="origin"
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
