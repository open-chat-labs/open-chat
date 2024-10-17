<script lang="ts">
    import InformationOutline from "svelte-material-icons/InformationOutline.svelte";
    import Delete from "svelte-material-icons/Delete.svelte";
    import {
        type AccessGate,
        type Level,
        isLeafGate,
        isCompositeGate,
        OpenChat,
        type AccessGateConfig,
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
    import { getContext } from "svelte";
    import { iconSize } from "../../../stores/iconSize";
    import AccessGateIcon from "./AccessGateIcon.svelte";
    import TooltipWrapper from "../../TooltipWrapper.svelte";
    import TooltipPopup from "../../TooltipPopup.svelte";
    import Checkbox from "../../Checkbox.svelte";
    import DurationPicker from "../DurationPicker.svelte";
    import AccessGateExpiry from "./AccessGateExpiry.svelte";

    const MAX_GATES = 5;
    const client = getContext<OpenChat>("client");

    export let gateConfig: AccessGateConfig;
    export let editable: boolean;
    export let level: Level;
    export let valid: boolean;

    let gateValidity: boolean[] = [];
    let selectedGateIndex: number | undefined = undefined;
    let gateBindings: GateBinding[] = getGateBindings(level);
    let evaluationIntervalValid: boolean;

    $: nervousSystemLookup = client.nervousSystemLookup;
    $: cryptoLookup = client.cryptoLookup;
    $: nsLedgers = new Set(Object.values($nervousSystemLookup).map((d) => d.ledgerCanisterId));
    $: neuronGateBindings = getNeuronGateBindings($nervousSystemLookup);
    $: paymentGateBindings = getPaymentGateBindings($cryptoLookup, nsLedgers);
    $: balanceGateBindings = getBalanceGateBindings($cryptoLookup);
    $: canAdd = isLeafGate(gateConfig.gate) || gateConfig.gate.gates.length < MAX_GATES;
    $: title = !editable ? i18nKey("access.readonlyTitle") : i18nKey("access.title");

    $: {
        valid =
            gateValidity.every((v) => v) &&
            (gateConfig.expiry !== undefined ? !editable || evaluationIntervalValid : true);
    }

    function addLeaf() {
        const newGate: AccessGate = { kind: "no_gate" };
        if (gateConfig.gate.kind === "composite_gate") {
            gateConfig.gate.gates.push(newGate);
        } else {
            gateConfig.gate = {
                kind: "composite_gate",
                gates: [gateConfig.gate, newGate],
                operator: "and",
            };
        }
        gateConfig = gateConfig;
        if (isCompositeGate(gateConfig.gate)) {
            selectedGateIndex = gateConfig.gate.gates.length - 1;
        }
    }

    function deleteGate(idx: number) {
        if (isCompositeGate(gateConfig.gate)) {
            gateConfig.gate.gates.splice(idx, 1);
            gateValidity.splice(idx, 1);
            if (gateConfig.gate.gates.length === 1) {
                gateConfig.gate = gateConfig.gate.gates[0];
            }
            gateConfig = gateConfig;
            gateValidity = gateValidity;
        }
    }

    function getGateText(gate: AccessGate) {
        const label = gateLabel[gate.kind];
        return label ? i18nKey(label) : i18nKey("access.unknownGate");
    }

    function toggleEvaluationInterval() {
        if (gateConfig.expiry === undefined) {
            gateConfig.expiry = BigInt(1000 * 60 * 60 * 24 * 7 * 4 * 3); // default this to three months
        } else {
            gateConfig.expiry = undefined;
        }
    }
</script>

<Overlay>
    <ModalContent closeIcon on:close>
        <div slot="header">
            <Translatable resourceKey={title} />
        </div>
        <div class="body access-gate-builder" slot="body">
            {#if isLeafGate(gateConfig.gate)}
                <LeafGateBuilder
                    {gateBindings}
                    {neuronGateBindings}
                    {paymentGateBindings}
                    {balanceGateBindings}
                    allowNone
                    bind:gate={gateConfig.gate}
                    {editable}
                    {level}
                    bind:valid={gateValidity[0]} />
            {:else if isCompositeGate(gateConfig.gate)}
                {#each gateConfig.gate.gates as subgate, i (`${subgate.kind} + ${i}`)}
                    <CollapsibleCard
                        transition={false}
                        open={selectedGateIndex === i}
                        on:opened={() => (selectedGateIndex = i)}>
                        <div class="sub-header" slot="titleSlot" class:invalid={!gateValidity[i]}>
                            <AccessGateIcon
                                {level}
                                showNoGate
                                gateConfig={{ expiry: undefined, gate: subgate }} />
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
            {#if editable}
                <div class="add">
                    <Button tiny disabled={!canAdd} on:click={addLeaf}>
                        <Translatable resourceKey={i18nKey("access.addGate")} />
                    </Button>
                    <div class="icon">
                        <TooltipWrapper position={"top"} align={"middle"}>
                            <InformationOutline
                                slot="target"
                                size={$iconSize}
                                color={"var(--txt)"} />
                            <div let:position let:align slot="tooltip">
                                <TooltipPopup {position} {align}>
                                    <Translatable resourceKey={i18nKey("access.addGateInfo")} />
                                </TooltipPopup>
                            </div>
                        </TooltipWrapper>
                    </div>
                </div>
            {/if}

            {#if gateConfig.gate.kind !== "no_gate"}
                {#if editable}
                    <div class="section expiry">
                        <Checkbox
                            id="evaluation-interval"
                            on:change={toggleEvaluationInterval}
                            label={i18nKey("access.evaluationInterval")}
                            align={"start"}
                            checked={gateConfig.expiry !== undefined}>
                            <div class="section-title disappear">
                                <Translatable resourceKey={i18nKey("access.evaluationInterval")} />
                            </div>
                            <div class="info">
                                <Translatable
                                    resourceKey={i18nKey(
                                        "access.evaluationIntervalInfo",
                                        undefined,
                                        level,
                                        true,
                                    )} />
                            </div>
                            <div class="info">
                                {#if gateConfig.expiry !== undefined}
                                    <DurationPicker
                                        bind:valid={evaluationIntervalValid}
                                        bind:milliseconds={gateConfig.expiry}
                                        unitFilter={(u) => !["minutes", "hours"].includes(u)} />
                                {/if}
                            </div>
                        </Checkbox>
                    </div>
                {:else if gateConfig.expiry !== undefined}
                    <div class="section expiry">
                        <AccessGateExpiry expiry={gateConfig.expiry} />
                    </div>
                {/if}
            {/if}
        </div>

        <div let:onClose slot="footer">
            <div class="access-gate-builder footer">
                {#if isCompositeGate(gateConfig.gate)}
                    <div class="operator">
                        <Select
                            disabled={!editable}
                            margin={false}
                            bind:value={gateConfig.gate.operator}>
                            <option value={"and"}
                                ><Translatable resourceKey={i18nKey("access.and")} /></option>
                            <option value={"or"}
                                ><Translatable resourceKey={i18nKey("access.or")} /></option>
                        </Select>
                    </div>
                {/if}
                <ButtonGroup>
                    <Button on:click={onClose}>
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

    .add {
        margin-top: $sp4;
        display: flex;
        align-items: center;
        gap: $sp3;

        .icon {
            position: relative;
            top: $sp2;
        }
    }

    .section.expiry {
        margin-top: $sp4;
    }

    .info {
        @include font(book, normal, fs-80, 22);
        color: var(--txt-light);
        margin-bottom: $sp3;
    }
</style>
