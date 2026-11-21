<!-- Says the app is offline and that what it shows (the cache) may be out of date (#10564), while
     the client's offlineStore says so (logic/network/offlineIndicator: a blip doesn't show or hide
     it). The library's OfflineStrip, the native shell's too, full width across the top of the
     window above the whole app, which moves down under it: its height goes on the root as
     --offline-strip, and Shell's frame starts below it, so it covers nothing (a header's name and
     buttons, the rail). Dialogs and their veils may cover it. It only says: the app reconnects by
     itself, so there's no action, and no dismiss, as it goes once the connection is back.
     TODO(design): the web plan has no offline indicator (GAPS.md). -->
<script lang="ts">
    import OfflineStrip from "@openchat/ui/src/lib/components/OfflineStrip.svelte";
    import { useOfflineIndicator } from "@src/logic/network/offlineIndicator.svelte";
    import { onDestroy } from "svelte";
    import { _ } from "svelte-i18n";

    const offline = useOfflineIndicator();
    let height = $state(0);

    $effect(() => {
        document.documentElement.style.setProperty(
            "--offline-strip",
            `${offline.shown ? height : 0}px`,
        );
    });
    onDestroy(() => document.documentElement.style.removeProperty("--offline-strip"));
</script>

<div class="offline">
    <OfflineStrip shown={offline.shown} text={$_("offlineBanner")} bind:height />
</div>

<style lang="scss">
    .offline {
        position: fixed;
        inset: 0 0 auto;
        /* over the shell, under the dialogs' veil */
        z-index: calc(var(--z-backdrop) - 1);
    }
</style>
