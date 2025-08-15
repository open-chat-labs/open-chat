<script lang="ts">
    import { onMount } from "svelte";

    interface Props {
        instagramMatch: RegExpMatchArray;
    }

    let { instagramMatch }: Props = $props();

    let code = $derived(instagramMatch && instagramMatch[1]);

    onMount(() => {
        if (!(<any>window).instgrm) {
            const script = document.createElement("script");
            script.src = "https://www.instagram.com/embed.js";
            script.async = true;
            document.body.appendChild(script);
        } else {
            (<any>window).instgrm.Embeds.process();
        }
    });
</script>

<blockquote
    class="instagram-media"
    data-instgrm-captioned
    data-instgrm-permalink={`https://www.instagram.com/reel/${code}/?utm_source=ig_embed&amp;utm_campaign=loading`}
    data-instgrm-version="14">
</blockquote>

<style lang="scss">
    :global(iframe.instagram-media.instagram-media-rendered) {
        min-width: unset !important;
        max-width: unset !important;
        width: 100%;
        margin: 0 !important;
        padding: 0 !important;
        border-radius: var(--rd) !important;
        border: var(--bw) solid var(--bd) !important;
    }
</style>
