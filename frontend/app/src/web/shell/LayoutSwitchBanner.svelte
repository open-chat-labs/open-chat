<!-- Offers a reload when the window is narrowed below the phone line (web plan 10b): the web UI is
     for desktop widths only, and a reload of the same URL gets the phone layout. The decision, the
     dismissal and following the width are logic/layout's, shared with the old trees. -->
<script lang="ts">
    import { interpolateNewUi } from "@i18n/i18n";
    import Banner from "@openchat/ui/src/lib/components/Banner.svelte";
    import { useLayoutSwitchBanner } from "@src/logic/layout/layoutSwitchBanner.svelte";
    import { _ } from "svelte-i18n";

    const banner = useLayoutSwitchBanner();
</script>

{#if banner.message !== undefined}
    <!-- TODO(design): no design for it; the library's Banner floating at the top of the window,
         over the app but under its dialogs (App: .top-banners, with the offline one) -->
    <div class="layout-switch" role="status">
        <Banner
            text={interpolateNewUi($_, banner.message)}
            actionLabel={$_("layoutSwitch.reload")}
            actionHandler={() => window.location.reload()}
            onDismiss={() => banner.dismiss()} />
    </div>
{/if}

<style lang="scss">
    .layout-switch {
        /* Banner draws the box; its tint is see-through, so this only puts the page's surface
           under it, in its shape, and lifts it off the shell */
        border-radius: var(--radius-md);
        background: var(--surface-1);
        box-shadow: var(--shadow-menu);
    }
</style>
