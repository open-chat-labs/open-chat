<script lang="ts">
    import { OpenChat, type AccessGate, type Level } from "openchat-client";
    import AccessGateIcon from "./AccessGateIcon.svelte";
    import { getGateBindings, type GateBinding } from "../../../utils/access";
    import { getContext } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import AccessGateBuilder from "./AccessGateBuilder.svelte";

    const client = getContext<OpenChat>("client");

    export let gate: AccessGate;
    export let editable: boolean;
    export let level: Level;
    export let valid: boolean;

    let showDetail = false;

    $: gateText = getGateText(gate);

    let gateBindings: Record<AccessGate["kind"], GateBinding> = client.toRecord(
        getGateBindings(),
        (b) => b.gate.kind,
    );

    function open() {
        showDetail = true;
    }

    function getGateText(gate: AccessGate) {
        const binding = gateBindings[gate.kind];
        if (binding) {
            return i18nKey(binding.label);
        }
        return undefined;
    }
</script>

{#if showDetail}
    <AccessGateBuilder
        bind:valid
        {level}
        on:close={() => (showDetail = false)}
        bind:gate
        {editable} />
{/if}

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div on:click={open} class:editable class="summary">
    <div class="icon">
        <AccessGateIcon showNoGate {gate} />
    </div>
    <div class="name">
        {#if gateText !== undefined}
            <Translatable resourceKey={gateText} />
        {/if}
    </div>
    {#if !valid}
        <div title={"invalid"} class="invalid">!</div>
    {/if}
</div>

<style lang="scss">
    .summary {
        width: fit-content;
        padding: $sp3 $sp4;
        display: flex;
        align-items: center;
        gap: $sp3;
        background-color: var(--button-bg);
        border-radius: var(--button-rd);
        transition:
            background ease-in-out 200ms,
            color ease-in-out 200ms;

        @media (hover: hover) {
            &:hover {
                background: var(--button-hv);
                color: var(--button-hv-txt);
            }
        }

        &.editable {
            cursor: pointer;
        }

        .invalid {
            color: var(--menu-warn);
        }
    }
</style>
