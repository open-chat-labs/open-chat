<script lang="ts">
    import type { DataContent, OpenChat } from "openchat-client";
    import { getContext } from "svelte";

    export let banner: DataContent;
    export let square: boolean = false;
    export let intersecting = false;

    const client = getContext<OpenChat>("client");

    $: style = intersecting ? `background-image: url(${client.communityBannerUrl(banner)})` : "";
</script>

<div class:square class="banner" {style}>
    <slot />
</div>

<style lang="scss">
    .banner {
        position: relative;
        background-size: cover;
        background-position: center center;
        border-radius: $sp3 $sp3 0 0;
        padding-bottom: 50%; // forces 2:1 aspect ratio

        &.square {
            border-radius: 0;
        }
    }
</style>
