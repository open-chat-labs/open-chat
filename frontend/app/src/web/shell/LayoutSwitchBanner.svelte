<!-- Offers a reload when the window is narrowed below the phone line (web plan 10b): the web UI is
     for desktop widths only, and a reload of the same URL gets the phone layout. The decision and
     the dismissal are logic/layout's, shared with the old trees. -->
<script lang="ts">
    import { dimensionsWidth } from "@client";
    import { interpolate } from "@i18n/i18n";
    import Banner from "@openchat/ui/src/lib/components/Banner.svelte";
    import IconButton from "@openchat/ui/src/lib/components/IconButton.svelte";
    import { LayoutSwitchBanner } from "@src/logic/layout/layoutSwitchBanner.svelte";
    import { STARTUP_LAYOUT_CONTEXT, type StartupLayout } from "@src/utils/layout";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";

    const banner = new LayoutSwitchBanner(
        getContext<StartupLayout | undefined>(STARTUP_LAYOUT_CONTEXT),
    );

    onMount(() => {
        const unsubscribe = dimensionsWidth.subscribe((width) => banner.widthChanged(width));
        return () => {
            unsubscribe();
            banner.destroy();
        };
    });
</script>

{#if banner.message !== undefined}
    <!-- TODO(design): no design for it; a slim bar floating at the top of the window, over the
         app but under its dialogs, as the library's Banner with a dismiss button -->
    <div class="layout-switch" role="status">
        <Banner
            text={interpolate($_, banner.message)}
            actionLabel={$_("layoutSwitch.reload")}
            actionHandler={() => window.location.reload()} />
        <IconButton
            icon="close"
            variant="ghost"
            label={$_("layoutSwitch.dismiss")}
            onClick={() => banner.dismiss()} />
    </div>
{/if}

<style lang="scss">
    .layout-switch {
        position: fixed;
        top: var(--space-8);
        left: 50%;
        transform: translateX(-50%);
        width: min(640px, calc(100vw - 2 * var(--space-16)));
        box-sizing: border-box;
        /* over the shell, under the dialogs' veil */
        z-index: calc(var(--z-backdrop) - 1);
        display: flex;
        align-items: center;
        gap: var(--space-4);
        padding: var(--space-4);
        border-radius: var(--radius-lg);
        background: var(--surface-1);
        box-shadow: var(--shadow-menu);
    }
</style>
