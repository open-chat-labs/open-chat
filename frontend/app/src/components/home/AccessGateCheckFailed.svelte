<script lang="ts">
    import ModalContent from "../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import type { AccessGate } from "openchat-client";
    import AccessGateSummary from "./AccessGateSummary.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    export let gate: AccessGate;
</script>

<ModalContent fixedWidth={$mobileWidth} fitToContent={!$mobileWidth} on:close>
    <div slot="header">{$_("access.gateCheckFailed")}</div>
    <div slot="body">
        <AccessGateSummary showHeader={false} {gate} />
    </div>
</ModalContent>
