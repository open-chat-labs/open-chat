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
    data-instgrm-version="14"
    style=" background:#FFF; border:0; border-radius:3px; box-shadow:0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15); margin: 1px; max-width:540px; min-width:326px; padding:0; width:99.375%; width:-webkit-calc(100% - 2px); width:calc(100% - 2px);">
</blockquote>
