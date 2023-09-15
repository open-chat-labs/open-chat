<script lang="ts">
    import type { DataContent, OpenChat } from "openchat-client";
    import { getContext } from "svelte";

    export let banner: DataContent;
    export let square: boolean = false;
    export let intersecting = false;
    export let hero = false;
    export let blur = false;

    const client = getContext<OpenChat>("client");

    $: style = intersecting ? `background-image: url(${client.communityBannerUrl(banner)})` : "";
</script>

<div class:hero class:square class="banner" {style}>
    <slot />
</div>

<style lang="scss">
    .banner {
        position: relative;
        background-size: cover;
        background-position: center center;
        border-radius: $sp3 $sp3 0 0;

        &:not(.hero) {
            padding-bottom: 50%; // forces 2:1 aspect ratio
        }

        &.hero {
            height: 300px;
        }

        &.square {
            border-radius: 0;
        }

        &.blur::before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: inherit;
            background-size: inherit;
            background-position: inherit;
            filter: blur(10px); /* Adjust the blur value as needed */
            opacity: 0.7; /* Adjust the opacity as needed */
        }
    }
</style>
