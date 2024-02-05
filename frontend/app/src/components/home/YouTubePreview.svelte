<script lang="ts">
    export let pinned: boolean;
    export let fill: boolean;
    export let youtubeMatch: RegExpMatchArray;

    $: youtubeCode =
        youtubeMatch && (youtubeMatch[1] ?? youtubeMatch[2] ?? youtubeMatch[3])?.split("?")[0];
    $: youtubeStartTime = youtubeMatch
        ? new URL(youtubeMatch[0]).searchParams.get("t") || "0"
        : "0";
</script>

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
        allowfullscreen />
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
