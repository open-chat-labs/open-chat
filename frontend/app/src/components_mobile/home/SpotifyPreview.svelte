<script lang="ts">
    interface Props {
        pinned: boolean;
        fill: boolean;
        matches: RegExpMatchArray;
    }

    let { pinned, fill, matches }: Props = $props();

    function buildUrl(type: string, id: string) {
        return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator`;
    }
    let type = $derived(matches[1]);
    let id = $derived(matches[2]);
    let url = $derived(buildUrl(type, id));
</script>

<div class="spotify_wrapper">
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
    .spotify_wrapper {
        display: flex;
        width: 100%;
    }

    iframe.pinned {
        pointer-events: none;
    }
</style>
