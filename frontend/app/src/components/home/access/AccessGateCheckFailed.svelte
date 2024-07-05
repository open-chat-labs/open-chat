<script lang="ts">
    import ModalContent from "../../ModalContent.svelte";
    import type { AccessGate } from "openchat-client";
    import AccessGateSummary from "./AccessGateSummary.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    export let gate: AccessGate;
</script>

<ModalContent fixedWidth={$mobileWidth} fitToContent={!$mobileWidth} on:close>
    <div slot="header"><Translatable resourceKey={i18nKey("access.gateCheckFailed")} /></div>
    <div slot="body">
        <AccessGateSummary showHeader={false} {gate} />
    </div>
</ModalContent>
