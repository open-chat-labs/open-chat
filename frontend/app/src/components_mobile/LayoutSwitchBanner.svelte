<!-- Offers a reload when the window is widened to the desktop line (web plan 10b): a reload of the
     same URL gets the desktop layout. The decision and the dismissal are logic/layout's, shared
     with the other trees. -->
<script lang="ts">
    import { dimensionsWidth } from "@client";
    import { i18nKey } from "@src/i18n/i18n";
    import { LayoutSwitchBanner } from "@src/logic/layout/layoutSwitchBanner.svelte";
    import { STARTUP_LAYOUT_CONTEXT, type StartupLayout } from "@src/utils/layout";
    import Translatable from "@shared_components/Translatable.svelte";
    import { Body, ColourVars, CommonButton, IconButton, Row } from "component-lib";
    import { getContext, onMount } from "svelte";
    import Close from "svelte-material-icons/Close.svelte";

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
    <!-- TODO(design): no design for it; a slim bar over the top of the app -->
    <Row
        supplementalClass={"layout_switch_banner"}
        gap={"sm"}
        padding={["sm", "sm", "sm", "lg"]}
        crossAxisAlignment={"center"}
        backgroundColor={ColourVars.surface2}
        shadow={"var(--shadow-menu)"}>
        <Body colour={"textPrimary"}>
            <Translatable resourceKey={banner.message} />
        </Body>
        <CommonButton size={"small"} mode={"active"} onClick={() => window.location.reload()}>
            <Translatable resourceKey={i18nKey("layoutSwitch.reload")} />
        </CommonButton>
        <IconButton size={"sm"} onclick={() => banner.dismiss()}>
            {#snippet icon(color)}
                <Close size={"1.2em"} {color} />
            {/snippet}
        </IconButton>
    </Row>
{/if}

<style lang="scss">
    :global(.container.layout_switch_banner) {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        @include z-index("upgrade-banner");
    }
</style>
