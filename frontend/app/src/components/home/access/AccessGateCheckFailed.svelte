<script lang="ts">
    import { mobileWidth, type EnhancedAccessGate } from "openchat-client";
    import { i18nKey } from "../../../i18n/i18n";
    import ModalContent from "../../ModalContent.svelte";
    import Translatable from "../../Translatable.svelte";
    import AccessGateSummary from "./AccessGateSummary.svelte";

    interface Props {
        gates: EnhancedAccessGate[];
        onClose: () => void;
    }

    let { gates, onClose }: Props = $props();
</script>

<ModalContent fixedWidth={$mobileWidth} fitToContent={!$mobileWidth} {onClose}>
    {#snippet header()}
        <div><Translatable resourceKey={i18nKey("access.gateCheckFailed")} /></div>
    {/snippet}
    {#snippet body()}
        <div class="body">
            {#each gates as gate}
                <AccessGateSummary
                    editable={false}
                    gateConfig={{ expiry: gate.expiry, gate }}
                    level={gate.level} />
            {/each}
        </div>
    {/snippet}
</ModalContent>

<style lang="scss">
    .body {
        display: flex;
        flex-direction: column;
        gap: $sp4;
    }
</style>
