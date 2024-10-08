<script lang="ts">
    import { type AccessGate, type Level } from "openchat-client";
    import AccessGateIcon from "./AccessGateIcon.svelte";
    import { gateLabel } from "../../../utils/access";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import AccessGateBuilder from "./AccessGateBuilder.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    export let gate: AccessGate;
    export let editable: boolean;
    export let level: Level;
    export let valid: boolean = true;
    export let showNoGate: boolean = false;

    let showDetail = false;

    $: gateText = getGateText(gate);

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
        dispatch("updated");
    }
</script>

{#if showDetail}
    <AccessGateBuilder bind:valid {level} on:close={close} bind:gate {editable} />
{/if}

{#if gate.kind !== "no_gate" || showNoGate}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class:invalid={!valid} on:click={open} class:editable class="summary">
        <div class="icon">
            <AccessGateIcon button {level} showNoGate {gate} />
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
        background-color: var(--button-bg);
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
            background-color: var(--error);
            @media (hover: hover) {
                &:hover {
                    background: var(--error);
                }
            }
        }
    }
</style>
