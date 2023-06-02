<script lang="ts">
    import type { Community, OpenChat } from "openchat-client";
    import { getContext } from "svelte";

    export let community: Community;
    export let square: boolean = false;

    const client = getContext<OpenChat>("client");
</script>

<div
    class:square
    class="banner"
    style={`background-image: url(${client.communityBannerUrl(community.banner)})`}>
    <slot />
</div>

<style lang="scss">
    .banner {
        position: relative;
        background-size: cover;
        background-position: center center;
        height: toRem(200);
        border-radius: $sp3 $sp3 0 0;

        &.square {
            border-radius: 0;
        }
    }
</style>
