<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { GroupGate } from "openchat-client";
    import GroupGateIcon from "../GroupGateIcon.svelte";
    import GroupGateParameters from "./GroupGateParameters.svelte";

    export let gate: GroupGate;
    $: showDetails =
        (gate.kind === "sns1_gate" || gate.kind === "openchat_gate") &&
        (gate.minDissolveDelay !== undefined || gate.minStakeE8s !== undefined);
</script>

{#if gate.kind !== "no_gate"}
    <div class="wrapper">
        <h4>{$_("group.groupGate")}</h4>
        <div class="gate" class:showDetails>
            <GroupGateIcon {gate} />
            {#if gate.kind === "diamond_gate"}
                <p>{$_("group.diamondMember")}</p>
            {:else if gate.kind === "openchat_gate"}
                <GroupGateParameters {gate} />
            {:else if gate.kind === "sns1_gate"}
                <GroupGateParameters {gate} />
            {/if}
        </div>
    </div>
{/if}

<style type="text/scss">
    .wrapper {
        margin-bottom: $sp4;
    }
    h4 {
        margin-bottom: $sp3;
    }

    .gate {
        @include font(light, normal, fs-90);

        display: flex;
        gap: $sp3;
        align-items: center;

        &.showDetails {
            align-items: start;
        }
    }
</style>
