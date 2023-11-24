<script lang="ts">
    import { _ } from "svelte-i18n";
    import { isNeuronGate, type AccessGate, isPaymentGate } from "openchat-client";
    import AccessGateIcon from "./AccessGateIcon.svelte";
    import AccessGateParameters from "./AccessGateParameters.svelte";

    export let gate: AccessGate;
    export let showHeader = true;
    $: showDetails =
        isPaymentGate(gate) ||
        (isNeuronGate(gate) &&
            (gate.minDissolveDelay !== undefined || gate.minStakeE8s !== undefined));
</script>

{#if gate.kind !== "no_gate"}
    <div class="wrapper">
        {#if showHeader}
            <h4>{$_("access.gate")}</h4>
        {/if}
        <div class="gate" class:showDetails>
            <AccessGateIcon {gate} />
            {#if gate.kind === "diamond_gate"}
                <p>{$_("access.diamondMember")}</p>
            {:else if isNeuronGate(gate) || gate.kind === "credential_gate" || isPaymentGate(gate)}
                <AccessGateParameters {gate} />
            {/if}
        </div>
    </div>
{/if}

<style lang="scss">
    .wrapper {
        margin-bottom: $sp4;
    }
    h4 {
        margin-bottom: $sp3;
    }

    .gate {
        @include font(light, normal, fs-90);

        display: flex;
        gap: $sp4;
        align-items: center;

        &.showDetails {
            align-items: start;
        }
    }
</style>
