<script lang="ts">
    import {
        type AccessGate,
        type AccessGateConfig,
        type Level,
        stripSuspendedGate,
    } from "@client";
    import AccessGateIcon from "./AccessGateIcon.svelte";
    import { gateLabel } from "../../../utils/access";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import AccessGateBuilder from "./AccessGateBuilder.svelte";
    import { _ } from "svelte-i18n";

    interface Props {
        gateConfig: AccessGateConfig;
        editable: boolean;
        level: Level;
        valid?: boolean;
        showNoGate?: boolean;
        onUpdated?: () => void;
    }

    let {
        gateConfig = $bindable(),
        editable,
        level,
        valid = $bindable(true),
        showNoGate = false,
        onUpdated,
    }: Props = $props();

    let showDetail = $state(false);

    function open(e: Event) {
        e.preventDefault();
        e.stopPropagation();
        showDetail = true;
    }

    function getGateResourceKey(gate: AccessGate) {
        return gateLabel[gate.kind] ?? "access.unknownGate";
    }

    function getGateText(gate: AccessGate) {
        if (gate.kind === "composite_gate") {
            return i18nKey(
                gate.gates.map((g) => $_(getGateResourceKey(g))).join(` ${gate.operator} `),
            );
        }
        return i18nKey(getGateResourceKey(gate));
    }

    function close() {
        showDetail = false;
        onUpdated?.();
    }
    // Display the gate with any suspended (unique person) gates stripped out. The underlying
    // gateConfig is left untouched so editing preserves the dormant gate.
    let displayGateConfig = $derived({ ...gateConfig, gate: stripSuspendedGate(gateConfig.gate) });
    let gateText = $derived(getGateText(displayGateConfig.gate));
</script>

{#if showDetail}
    {#if editable}
        <AccessGateBuilder bind:valid {level} onClose={close} bind:gateConfig {editable} />
    {:else}
        <AccessGateBuilder bind:valid {level} onClose={close} gateConfig={displayGateConfig} {editable} />
    {/if}
{/if}

{#if displayGateConfig.gate.kind !== "no_gate" || showNoGate}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class:invalid={!valid} onclick={open} class:editable class="summary">
        <div class="icon">
            <AccessGateIcon button {level} showNoGate gateConfig={displayGateConfig} />
        </div>
        <div class="name">
            {#if gateText !== undefined}
                <Translatable resourceKey={gateText} />
            {/if}
        </div>
    </div>
{/if}

<style lang="scss">
    .summary {
        width: fit-content;
        padding: $sp3 $sp4;
        display: flex;
        align-items: center;
        gap: $sp3;
        background: var(--button-bg);
        border-radius: var(--button-rd);
        color: var(--button-txt);
        transition:
            background ease-in-out 200ms,
            color ease-in-out 200ms;
        cursor: pointer;

        @media (hover: hover) {
            &:hover {
                background: var(--button-hv);
                color: var(--button-hv-txt);
            }
        }

        &.invalid {
            background: var(--toast-failure-bg);
            color: var(--toast-failure-txt);
        }
    }
</style>
