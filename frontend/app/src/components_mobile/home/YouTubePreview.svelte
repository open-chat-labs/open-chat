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

<iframe
    class:pinned
    class:fill
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

<style lang="scss">
    iframe {
        width: 78vw; // Max width of the message bubble
        height: 16rem;
    }

    iframe.pinned {
        pointer-events: none;
    }
</style>
