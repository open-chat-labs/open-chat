<script lang="ts">
    import Delete from "svelte-material-icons/Delete.svelte";
    import {
        type AccessGate,
        type Level,
        isLeafGate,
        isCompositeGate,
        OpenChat,
    } from "openchat-client";
    import ModalContent from "../../ModalContent.svelte";
    import Overlay from "../../Overlay.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { _ } from "svelte-i18n";
    import Button from "../../Button.svelte";
    import LeafGateBuilder from "./LeafGateBuilder.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Select from "../../Select.svelte";
    import CollapsibleCard from "../../CollapsibleCard.svelte";
    import {
        gateLabel,
        getBalanceGateBindings,
        getGateBindings,
        getNeuronGateBindings,
        getPaymentGateBindings,
        type GateBinding,
    } from "../../../utils/access";
    import { afterUpdate, getContext } from "svelte";
    import { iconSize } from "../../../stores/iconSize";
    import AccessGateIcon from "./AccessGateIcon.svelte";

    const MAX_GATES = 5;
    const client = getContext<OpenChat>("client");

    export let gate: AccessGate;
    export let editable: boolean;
    export let level: Level;
    export let valid: boolean;

    let gateValidity: boolean[] = [];
    let selectedGateIndex: number | undefined = undefined;
    let gateBindings: GateBinding[] = getGateBindings();
    $: nervousSystemLookup = client.nervousSystemLookup;
    $: cryptoLookup = client.cryptoLookup;
    $: nsLedgers = new Set(Object.values($nervousSystemLookup).map((d) => d.ledgerCanisterId));
    $: neuronGateBindings = getNeuronGateBindings($nervousSystemLookup);
    $: paymentGateBindings = getPaymentGateBindings($cryptoLookup, nsLedgers);
    $: balanceGateBindings = getBalanceGateBindings($cryptoLookup);
    $: canAdd = isLeafGate(gate) || gate.gates.length < MAX_GATES;
    $: title = !editable ? i18nKey("access.readonlyTitle") : i18nKey("access.title");

    afterUpdate(() => {
        valid = gateValidity.every((v) => v);
    });

    function addLeaf() {
        const newGate: AccessGate = { kind: "no_gate" };
        if (gate.kind === "composite_gate") {
            gate.gates.push(newGate);
        } else {
            gate = {
                kind: "composite_gate",
                gates: [gate, newGate],
                operator: "and",
            };
        }
        gate = gate;
        selectedGateIndex = gate.gates.length - 1;
    }

    function deleteGate(idx: number) {
        if (isCompositeGate(gate)) {
            gate.gates.splice(idx, 1);
            gateValidity.splice(idx, 1);
            if (gate.gates.length === 1) {
                gate = gate.gates[0];
            }
            gate = gate;
            gateValidity = gateValidity;
        }
    }

    function getGateText(gate: AccessGate) {
        const label = gateLabel[gate.kind];
        return label ? i18nKey(label) : i18nKey("access.unknownGate");
    }
</script>

<Overlay>
    <ModalContent closeIcon on:close>
        <div slot="header">
            <Translatable resourceKey={title} />
        </div>
        <div class="body access-gate-builder" slot="body">
            {#if isLeafGate(gate)}
                <LeafGateBuilder
                    {gateBindings}
                    {neuronGateBindings}
                    {paymentGateBindings}
                    {balanceGateBindings}
                    allowNone
                    bind:gate
                    {editable}
                    {level}
                    bind:valid={gateValidity[0]} />
            {:else if isCompositeGate(gate)}
                {#each gate.gates as subgate, i (`${subgate.kind} + ${i}`)}
                    <CollapsibleCard
                        transition={false}
                        open={selectedGateIndex === i}
                        on:opened={() => (selectedGateIndex = i)}>
                        <div class="sub-header" slot="titleSlot" class:invalid={!gateValidity[i]}>
                            <AccessGateIcon {level} showNoGate gate={subgate} />
                            <Translatable resourceKey={getGateText(subgate)} />
                            {#if editable}
                                <!-- svelte-ignore a11y-click-events-have-key-events -->
                                <!-- svelte-ignore a11y-no-static-element-interactions -->
                                <div on:click={() => deleteGate(i)} class="delete">
                                    <Delete
                                        viewBox={"0 -3 24 24"}
                                        size={$iconSize}
                                        color={"var(--icon-txt)"} />
                                </div>
                            {/if}
                        </div>
                        <LeafGateBuilder
                            {gateBindings}
                            {neuronGateBindings}
                            {paymentGateBindings}
                            {balanceGateBindings}
                            allowNone={false}
                            bind:gate={subgate}
                            {editable}
                            {level}
                            bind:valid={gateValidity[i]} />
                    </CollapsibleCard>
                {/each}
            {/if}
        </div>

        <div let:onClose slot="footer">
            <div class="access-gate-builder footer">
                {#if isCompositeGate(gate)}
                    <div class="operator">
                        <Select disabled={!editable} margin={false} bind:value={gate.operator}>
                            <option value={"and"}
                                ><Translatable resourceKey={i18nKey("access.and")} /></option>
                            <option value={"or"}
                                ><Translatable resourceKey={i18nKey("access.or")} /></option>
                        </Select>
                    </div>
                {/if}
                <ButtonGroup>
                    {#if editable}
                        <Button disabled={!canAdd} on:click={addLeaf}>
                            <Translatable resourceKey={i18nKey("access.addGate")} />
                        </Button>
                    {/if}
                    <Button on:click={onClose} disabled={!valid}>
                        <Translatable resourceKey={i18nKey("close")} />
                    </Button>
                </ButtonGroup>
            </div>
        </div>
    </ModalContent>
</Overlay>

<style lang="scss">
    :global(.operator .wrapper) {
        width: 100%;
    }

    :global(.access-gate-builder .card .body) {
        padding: $sp4;
        background-color: rgba(255, 255, 255, 0.1);
    }

    :global(.access-gate-builder.footer .button-group) {
        flex: auto;
    }

    .operator {
        flex: auto;
    }

    .footer {
        display: flex;
        align-items: center;
        gap: $sp3;
        justify-content: space-between;
    }

    .sub-header {
        display: flex;
        gap: $sp3;
        align-items: center;

        .delete {
            cursor: pointer;
        }

        &.invalid::after {
            content: "!";
            color: var(--menu-warn);
        }
    }
</style>
