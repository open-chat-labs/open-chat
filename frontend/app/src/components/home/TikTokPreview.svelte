<script lang="ts">
    import { onMount } from "svelte";

    interface Props {
        tiktokMatch: RegExpMatchArray;
    }

    let { tiktokMatch }: Props = $props();

    let [, username, videoId] = $derived(tiktokMatch);

    onMount(() => {
        if (!(window as any).tiktokEmbed) {
            const script = document.createElement("script");
            script.src = "https://www.tiktok.com/embed.js";
            script.async = true;
            document.body.appendChild(script);
        } else {
            (window as any).tiktokEmbed.load();
        }
    });
</script>

<blockquote
    class="tiktok-embed"
    cite={`https://www.tiktok.com/@${username}/video/${videoId}`}
    data-video-id={videoId}
    style="max-width: 605px;min-width: 325px;">
</blockquote>
