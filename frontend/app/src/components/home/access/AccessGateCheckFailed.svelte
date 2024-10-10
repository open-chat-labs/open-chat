<script lang="ts">
    import ModalContent from "../../ModalContent.svelte";
    import type { EnhancedAccessGate } from "openchat-client";
    import AccessGateSummary from "./AccessGateSummary.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    export let gates: EnhancedAccessGate[];
</script>

<ModalContent fixedWidth={$mobileWidth} fitToContent={!$mobileWidth} on:close>
    <div slot="header"><Translatable resourceKey={i18nKey("access.gateCheckFailed")} /></div>
    <div class="body" slot="body">
        {#each gates as gate}
            <AccessGateSummary editable={false} {gate} level={gate.level} />
        {/each}
    </div>
</ModalContent>

<style lang="scss">
    .body {
        display: flex;
        flex-direction: column;
        gap: $sp4;
    }
</style>
