<!-- Offers a reload when the window is widened to the desktop line (web plan 10b): a reload of the
     same URL gets the desktop layout. The decision, the dismissal and following the width are
     logic/layout's, shared with the other trees. It sits in App's top banners, under the update
     banner. -->
<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { useLayoutSwitchBanner } from "@src/logic/layout/layoutSwitchBanner.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import { Body, ColourVars, CommonButton, IconButton, Row } from "component-lib";
    import Close from "svelte-material-icons/Close.svelte";

    const banner = useLayoutSwitchBanner();
</script>

{#if banner.message !== undefined}
    <!-- TODO(design): no design for it; a slim bar over the top of the app -->
    <Row
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
