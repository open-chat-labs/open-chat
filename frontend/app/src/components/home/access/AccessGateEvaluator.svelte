<script lang="ts">
    import VectorCombine from "svelte-material-icons/VectorCombine.svelte";
    import {
        isCompositeGate,
        isCredentialGate,
        isLeafGate,
        isPaymentGate,
        isUniquePersonGate,
        isLifetimeDiamondGate,
        isDiamondGate,
        OpenChat,
        shouldPreprocessGate,
        type EnhancedAccessGate,
        type LeafGate,
        type PaymentGateApprovals,
        type GateCheckSucceeded,
    } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../../i18n/i18n";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import { getContext, onMount } from "svelte";
    import PaymentGateEvaluator from "./PaymentGateEvaluator.svelte";
    import DiamondGateEvaluator from "./DiamondGateEvaluator.svelte";
    import CredentialGateEvaluator from "./CredentialGateEvaluator.svelte";
    import UniqueHumanGateEvaluator from "./UniqueHumanGateEvaluator.svelte";
    import Translatable from "../../Translatable.svelte";
    import AccessGateSummary from "./AccessGateSummary.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import Radio from "../../Radio.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        gates: EnhancedAccessGate[];
        onSuccess: (success: GateCheckSucceeded) => void;
        onClose: () => void;
    }

    let { gates, onSuccess, onClose }: Props = $props();

    let result: IteratorResult<EnhancedAccessGate>;
    let iterator = preprocessGates(gates, needsPreprocessing);
    let currentGate: EnhancedAccessGate | undefined = $state();
    let credentials: string[] = [];
    let paymentApprovals: PaymentGateApprovals = new Map();
    let optionalGatesByIndex: Map<number, LeafGate> = $state(new Map());
    let optionalInvalid = $derived(
        currentGate?.kind === "composite_gate" &&
            optionalGatesByIndex.size >= currentGate.gates.length,
    );

    onMount(nextGate);

    function needsPreprocessing(gate: EnhancedAccessGate): boolean {
        if (isCompositeGate(gate) && gate.operator === "or") {
            return gate.gates.some((g) => shouldPreprocessGate(g));
        } else {
            return shouldPreprocessGate(gate);
        }
    }

    function leafGatesMatch(a: LeafGate, b: LeafGate) {
        return JSON.stringify(a) === JSON.stringify(b);
    }

    function nextGate() {
        result = iterator.next();
        if (!result.done) {
            currentGate = result.value;
            if (isCompositeGate(currentGate) && currentGate.operator === "or") {
                optionalGatesByIndex = new Map(
                    currentGate.gates.map((g, i) => [
                        i,
                        { ...g, level: currentGate?.level, expiry: currentGate?.expiry },
                    ]),
                );
            }
            if (isLeafGate(currentGate)) {
                const found = [...optionalGatesByIndex.values()].find((g) =>
                    leafGatesMatch(g, currentGate as LeafGate),
                );
                if (found || client.doesUserMeetAccessGate(currentGate)) {
                    nextGate();
                }
            }
        } else {
            currentGate = undefined;
            onSuccess({ credentials, paymentApprovals });
        }
    }

    function* preprocessGates(
        gates: EnhancedAccessGate[],
        predicate: (gate: EnhancedAccessGate) => boolean,
    ): Generator<EnhancedAccessGate> {
        for (const gate of gates) {
            if (predicate(gate)) {
                yield gate;
            }
            if (isCompositeGate(gate)) {
                yield* preprocessGates(
                    gate.gates.map((g) => ({ ...g, level: gate.level, expiry: gate.expiry })),
                    predicate,
                );
            }
        }
    }

    function approvePayment({
        detail: { ledger, amount, approvalFee },
    }: CustomEvent<{ ledger: string; amount: bigint; approvalFee: bigint }>) {
        const existing = paymentApprovals.get(ledger);
        if (existing !== undefined) {
            // if we already have an approval pending for this ledger we add on the amount
            // but there will only be one fee
            existing.amount += amount;
            paymentApprovals.set(ledger, existing);
        } else {
            paymentApprovals.set(ledger, {
                amount,
                approvalFee,
            });
        }
        nextGate();
    }

    function credentialReceived(ev: CustomEvent<string>) {
        credentials.push(ev.detail);
        nextGate();
    }

    function toggleIndex(i: number, parent: EnhancedAccessGate | undefined) {
        if (parent === undefined || !isCompositeGate(parent)) return;

        const found = optionalGatesByIndex.has(i);
        optionalGatesByIndex = new Map(
            parent.gates.map((g, i) => [i, { ...g, level: parent.level, expiry: parent.expiry }]),
        );
        if (found) {
            optionalGatesByIndex.delete(i);
        }
        optionalGatesByIndex = optionalGatesByIndex;
    }
</script>

<ModalContent
    hideHeader
    hideFooter={currentGate !== undefined && currentGate.kind !== "composite_gate"}
    closeIcon
    {onClose}>
    {#snippet body()}
        <div class="body access-gate-evaluator">
            {#if currentGate}
                {#if isCompositeGate(currentGate) && currentGate.operator === "or"}
                    <div class="header">
                        <div class="icon">
                            <VectorCombine size={$iconSize} color={"var(--txt)"} />
                        </div>
                        <p class="title">
                            <Translatable resourceKey={i18nKey("access.chooseOneGate")} />
                        </p>
                    </div>
                    <p class="subtitle">
                        <Translatable resourceKey={i18nKey("access.chooseOneGateInfo")} />
                    </p>

                    {#each currentGate.gates as subgate, i}
                        <div class="optional-gate">
                            <Radio
                                group={"optional_gates"}
                                checked={!optionalGatesByIndex.has(i)}
                                on:change={() => toggleIndex(i, currentGate)}
                                label={i18nKey(subgate.kind)}
                                id={`subgate_${i}`}>
                                <AccessGateSummary
                                    editable={false}
                                    level={currentGate.level}
                                    showNoGate={false}
                                    gateConfig={{ expiry: undefined, gate: subgate }} />
                            </Radio>
                        </div>
                    {/each}
                {:else if isCredentialGate(currentGate)}
                    <CredentialGateEvaluator
                        on:close={onClose}
                        on:credentialReceived={credentialReceived}
                        gate={currentGate}
                        level={currentGate.level} />
                {:else if isUniquePersonGate(currentGate)}
                    <UniqueHumanGateEvaluator
                        on:credentialReceived={credentialReceived}
                        on:close={onClose}
                        expiry={currentGate.expiry}
                        level={currentGate.level} />
                {:else if isPaymentGate(currentGate)}
                    <PaymentGateEvaluator
                        {paymentApprovals}
                        gate={currentGate}
                        level={currentGate.level}
                        on:approvePayment={approvePayment}
                        on:close={onClose} />
                {:else if isLifetimeDiamondGate(currentGate)}
                    <DiamondGateEvaluator
                        level={currentGate.level}
                        lifetime
                        on:credentialReceived={credentialReceived}
                        on:cancel={onClose} />
                {:else if isDiamondGate(currentGate)}
                    <DiamondGateEvaluator
                        level={currentGate.level}
                        lifetime={false}
                        on:credentialReceived={credentialReceived}
                        on:cancel={onClose} />
                {/if}
            {/if}
        </div>
    {/snippet}

    {#snippet footer()}
        <div>
            <ButtonGroup>
                {#if currentGate !== undefined}
                    {#if isCompositeGate(currentGate)}
                        <Button disabled={optionalInvalid} on:click={nextGate}>
                            <Translatable resourceKey={i18nKey("access.next")} />
                        </Button>
                    {/if}
                {:else}
                    <Button on:click={onClose}>
                        <Translatable resourceKey={i18nKey("access.join")} />
                    </Button>
                {/if}
            </ButtonGroup>
        </div>
    {/snippet}
</ModalContent>

<style lang="scss">
    .header {
        @include font(bold, normal, fs-130, 29);
        margin-bottom: $sp4;
        display: flex;
        align-items: center;
        gap: $sp3;
    }
    .subtitle {
        margin-bottom: $sp4;
    }
    .optional-gate {
        margin-bottom: $sp3;
    }
</style>
