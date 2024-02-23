<script lang="ts">
    export let pinned: boolean;
    export let fill: boolean;
    export let matches: RegExpMatchArray;

    $: type = matches[1];
    $: id = matches[2];
    $: url = buildUrl(type, id);

    function buildUrl(type: string, id: string) {
        return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator`;
    }
</script>

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
