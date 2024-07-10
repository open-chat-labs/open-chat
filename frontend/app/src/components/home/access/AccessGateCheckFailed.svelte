<script lang="ts">
    import ModalContent from "../../ModalContent.svelte";
    import type { AccessGate, Level } from "openchat-client";
    import AccessGateSummary from "./AccessGateSummary.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    export let gate: AccessGate;
    export let level: Level;
</script>

<ModalContent fixedWidth={$mobileWidth} fitToContent={!$mobileWidth} on:close>
    <div slot="header"><Translatable resourceKey={i18nKey("access.gateCheckFailed")} /></div>
    <div slot="body">
        <AccessGateSummary editable={false} {gate} {level} />
    </div>
</ModalContent>
