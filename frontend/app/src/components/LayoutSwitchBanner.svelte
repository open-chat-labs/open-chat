<!-- Offers a reload when the window crosses the line between the phone layout and the desktop one
     (web plan 10b). This tree is the narrow one in a build with the new web UI but without the
     mobile App (OC_MOBILE_LAYOUT=v1, as the web builds are), so widening it offers the new web UI.
     The decision, the dismissal and following the width are logic/layout's, shared with the other
     trees. It sits in App's top banners, under the update banner. -->
<script lang="ts">
    import { iconSize } from "@client";
    import { i18nKey } from "@src/i18n/i18n";
    import { useLayoutSwitchBanner } from "@src/logic/layout/layoutSwitchBanner.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import { _ } from "svelte-i18n";
    import Close from "svelte-material-icons/Close.svelte";
    import Button from "./Button.svelte";
    import HoverIcon from "./HoverIcon.svelte";

    const banner = useLayoutSwitchBanner();
</script>

{#if banner.message !== undefined}
    <!-- TODO(design): no design for it; a slim bar over the top of the app -->
    <div class="layout-switch-banner" role="status">
        <span class="message"><Translatable resourceKey={banner.message} /></span>
        <Button small onClick={() => window.location.reload()}>
            <Translatable resourceKey={i18nKey("layoutSwitch.reload")} />
        </Button>
        <HoverIcon title={$_("layoutSwitch.dismiss")} onclick={() => banner.dismiss()}>
            <Close size={$iconSize} color={"var(--notificationBar-txt)"} />
        </HoverIcon>
    </div>
{/if}

<style lang="scss">
    .layout-switch-banner {
        display: flex;
        align-items: center;
        gap: $sp3;
        padding: $sp2 $sp3 $sp2 $sp4;
        background-color: var(--notificationBar-bg);
        color: var(--notificationBar-txt);
        @include box-shadow(2);
    }

    .message {
        flex: 1;
        min-width: 0;
    }
</style>
