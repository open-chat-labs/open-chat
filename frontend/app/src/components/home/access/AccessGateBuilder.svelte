<script lang="ts">
    import {
        cryptoLookup,
        iconSize,
        isCompositeGate,
        isLeafGate,
        nervousSystemLookup,
        type AccessGate,
        type AccessGateConfig,
        type Level,
    } from "openchat-client";
    import Delete from "svelte-material-icons/Delete.svelte";
    import InformationOutline from "svelte-material-icons/InformationOutline.svelte";
    import Tooltip from "../../../components/tooltip/Tooltip.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import {
        gateLabel,
        getBalanceGateBindings,
        getGateBindings,
        getNeuronGateBindings,
        getPaymentGateBindings,
        type GateBinding,
    } from "../../../utils/access";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Checkbox from "../../Checkbox.svelte";
    import CollapsibleCard from "../../CollapsibleCard.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Overlay from "../../Overlay.svelte";
    import Select from "../../Select.svelte";
    import Translatable from "../../Translatable.svelte";
    import DurationPicker from "../DurationPicker.svelte";
    import AccessGateExpiry from "./AccessGateExpiry.svelte";
    import AccessGateIcon from "./AccessGateIcon.svelte";
    import LeafGateBuilder from "./LeafGateBuilder.svelte";

    const MAX_GATES = 5;

    interface Props {
        gateConfig: AccessGateConfig;
        editable: boolean;
        level: Level;
        valid: boolean;
        onClose: () => void;
    }

    let {
        gateConfig = $bindable(),
        editable,
        level,
        valid = $bindable(),
        onClose,
    }: Props = $props();

    let gateValidity: boolean[] = $state([]);
    let selectedGateIndex: number | undefined = $state(undefined);
    let gateBindings: GateBinding[] = getGateBindings(level);
    let evaluationIntervalValid = $state(true);
    let nsLedgers = $derived(
        new Set([...$nervousSystemLookup.values()].map((d) => d.ledgerCanisterId)),
    );
    let neuronGateBindings = $derived(getNeuronGateBindings($nervousSystemLookup));
    let paymentGateBindings = $derived(getPaymentGateBindings($cryptoLookup, nsLedgers));
    let balanceGateBindings = $derived(getBalanceGateBindings($cryptoLookup));
    let canAdd = $derived(isLeafGate(gateConfig.gate) || gateConfig.gate.gates.length < MAX_GATES);
    let title = $derived(!editable ? i18nKey("access.readonlyTitle") : i18nKey("access.title"));

    $effect(() => {
        const isValid =
            gateValidity.every((v) => v) &&
            (gateConfig.expiry !== undefined ? !editable || evaluationIntervalValid : true);

        if (isValid !== valid) {
            valid = isValid;
        }
    });

    function addLeaf() {
        const newGate: AccessGate = { kind: "no_gate" };
        if (gateConfig.gate.kind === "composite_gate") {
            gateConfig.gate.gates.push(newGate);
        } else {
            const oldGate = { ...gateConfig.gate };
            gateConfig.gate = {
                kind: "composite_gate",
                gates: [oldGate, newGate],
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

<Overlay {onClose}>
    <ModalContent closeIcon {onClose}>
        {#snippet header()}
            <Translatable resourceKey={title} />
        {/snippet}
        {#snippet body()}
            <div class="body access-gate-builder">
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
                            onOpened={() => (selectedGateIndex = i)}>
                            {#snippet titleSlot()}
                                <div class="sub-header" class:invalid={!gateValidity[i]}>
                                    <AccessGateIcon
                                        {level}
                                        showNoGate
                                        gateConfig={{ expiry: undefined, gate: subgate }} />
                                    <Translatable resourceKey={getGateText(subgate)} />
                                    {#if editable}
                                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                                        <div onclick={() => deleteGate(i)} class="delete">
                                            <Delete
                                                viewBox={"0 -3 24 24"}
                                                size={$iconSize}
                                                color={"var(--icon-txt)"} />
                                        </div>
                                    {/if}
                                </div>
                            {/snippet}
                            <LeafGateBuilder
                                {gateBindings}
                                {neuronGateBindings}
                                {paymentGateBindings}
                                {balanceGateBindings}
                                allowNone={false}
                                bind:gate={gateConfig.gate.gates[i]}
                                {editable}
                                {level}
                                bind:valid={gateValidity[i]} />
                        </CollapsibleCard>
                    {/each}
                {/if}
                {#if editable}
                    <div class="add">
                        <Button tiny disabled={!canAdd} onClick={addLeaf}>
                            <Translatable resourceKey={i18nKey("access.addGate")} />
                        </Button>
                        <div class="icon">
                            <Tooltip position={"top"} align={"middle"}>
                                <InformationOutline size={$iconSize} color={"var(--txt)"} />
                                {#snippet popupTemplate()}
                                    <Translatable resourceKey={i18nKey("access.addGateInfo")} />
                                {/snippet}
                            </Tooltip>
                        </div>
                    </div>
                {/if}

                {#if gateConfig.gate.kind !== "no_gate"}
                    {#if editable}
                        <div class="section expiry">
                            <Checkbox
                                id="evaluation-interval"
                                onChange={toggleEvaluationInterval}
                                label={i18nKey("access.evaluationInterval")}
                                align={"start"}
                                checked={gateConfig.expiry !== undefined}>
                                <div class="section-title disappear">
                                    <Translatable
                                        resourceKey={i18nKey("access.evaluationInterval")} />
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
        {/snippet}

        {#snippet footer()}
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
                    <Button onClick={onClose}>
                        <Translatable resourceKey={i18nKey("close")} />
                    </Button>
                </ButtonGroup>
            </div>
        {/snippet}
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
