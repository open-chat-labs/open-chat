<script lang="ts">
    import ModalContent from "../../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import type { AccessGate } from "openchat-client";
    import GroupGateSummary from "./AccessGateSummary.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    export let gate: AccessGate;
</script>

<ModalContent fixedWidth={$mobileWidth} fitToContent={!$mobileWidth} on:close>
    <div slot="header">{$_("group.gateCheckFailed")}</div>
    <div slot="body">
        <GroupGateSummary showHeader={false} {gate} />
    </div>
</ModalContent>
