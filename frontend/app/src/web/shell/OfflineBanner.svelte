<!-- Says the app is offline and that what it shows (the cache) may be out of date (#10564), while
     the client's offlineStore says so (logic/network/offlineIndicator: a blip doesn't show or hide
     it). It only says: the app reconnects by itself, so there's no action, and no dismiss, as it
     goes once the connection is back. -->
<script lang="ts">
    import Banner from "@openchat/ui/src/lib/components/Banner.svelte";
    import { useOfflineIndicator } from "@src/logic/network/offlineIndicator.svelte";
    import { _ } from "svelte-i18n";

    const offline = useOfflineIndicator();
</script>

{#if offline.shown}
    <!-- TODO(design): the web plan has no offline indicator; the library's offline Banner
         floating at the top of the window (App: .top-banners), as the layout switch's -->
    <div class="offline" role="status">
        <Banner tone="offline" text={$_("offlineBanner")} />
    </div>
{/if}

<style lang="scss">
    .offline {
        /* Banner draws the box; its tint is see-through, so this only puts the page's surface
           under it, in its shape, and lifts it off the shell */
        border-radius: var(--radius-md);
        background: var(--surface-1);
        box-shadow: var(--shadow-menu);
    }
</style>
