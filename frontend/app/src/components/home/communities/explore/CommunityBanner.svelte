<script lang="ts">
    import type { DataContent, OpenChat } from "openchat-client";
    import { getContext } from "svelte";

    export let banner: DataContent;
    export let square: boolean = false;

    const client = getContext<OpenChat>("client");
</script>

<div
    class:square
    class="banner"
    style={`background-image: url(${client.communityBannerUrl(banner)})`}>
    <slot />
</div>

<style lang="scss">
    .banner {
        position: relative;
        background-size: cover;
        background-position: center center;
        height: toRem(200);
        border-radius: $sp3 $sp3 0 0;
        transition: background-size 250ms ease-in-out;

        &.square {
            border-radius: 0;
        }
    }
</style>
