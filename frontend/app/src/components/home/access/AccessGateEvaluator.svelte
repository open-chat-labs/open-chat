<script lang="ts">
    import {
        iconSize,
        isCompositeGate,
        isCredentialGate,
        isDiamondGate,
        isLifetimeDiamondGate,
        isPaymentGate,
        OpenChat,
        type EnhancedAccessGate,
        type GateCheckSucceeded,
    } from "@client";
    import {
        GateEvaluation,
        type EvaluatedLeafGate,
    } from "@shared_components/home/access/gateEvaluation.svelte";
    import { getContext } from "svelte";
    import CheckCircle from "svelte-material-icons/CheckCircle.svelte";
    import VectorCombine from "svelte-material-icons/VectorCombine.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Checkbox from "../../Checkbox.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import AccessGateSummary from "./AccessGateSummary.svelte";
    import CredentialGateEvaluator from "./CredentialGateEvaluator.svelte";
    import DiamondGateEvaluator from "./DiamondGateEvaluator.svelte";
    import PaymentGateEvaluator from "./PaymentGateEvaluator.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        gates: EnhancedAccessGate[];
        onSuccess: (success: GateCheckSucceeded) => void;
        onClose: () => void;
    }

    let { gates, onSuccess, onClose }: Props = $props();

    // svelte-ignore state_referenced_locally
    const evaluation = new GateEvaluation(client, gates);

    // originalIndex of the leaf the user is satisfying
    let selected = $state<number>();
    let evaluatingGate = $derived(evaluation.leaves.find((g) => g.originalIndex === selected));

    function select(leaf: EvaluatedLeafGate | undefined) {
        selected = leaf?.originalIndex;
    }

    function canSatisfy(leaf: EvaluatedLeafGate): boolean {
        return (
            isPaymentGate(leaf) ||
            isCredentialGate(leaf) ||
            isDiamondGate(leaf) ||
            isLifetimeDiamondGate(leaf)
        );
    }

    function onApprovePayment(approval: { ledger: string; amount: bigint; approvalFee: bigint }) {
        if (evaluatingGate !== undefined) {
            evaluation.approvePayment(evaluatingGate, approval);
            select(undefined);
        }
    }

    function credentialReceived(cred: string) {
        if (evaluatingGate !== undefined) {
            evaluation.addCredential(evaluatingGate, cred);
            select(undefined);
        }
    }

    function nextGate() {
        const gateCheck = evaluation.next();
        if (gateCheck !== undefined) {
            onSuccess(gateCheck);
        }
    }
</script>

<ModalContent hideHeader hideFooter={evaluatingGate !== undefined} closeIcon {onClose}>
    {#snippet body()}
        <div class="body access-gate-evaluator">
            {#if evaluatingGate !== undefined}
                {#if isCredentialGate(evaluatingGate)}
                    <CredentialGateEvaluator
                        onClose={() => select(undefined)}
                        onCredentialReceived={credentialReceived}
                        gate={evaluatingGate}
                        level={evaluatingGate.level} />
                {:else if isPaymentGate(evaluatingGate)}
                    <PaymentGateEvaluator
                        {evaluation}
                        gate={evaluatingGate}
                        level={evaluatingGate.level}
                        {onApprovePayment}
                        onClose={() => select(undefined)} />
                {:else if isLifetimeDiamondGate(evaluatingGate)}
                    <DiamondGateEvaluator
                        level={evaluatingGate.level}
                        lifetime
                        onCredentialReceived={credentialReceived}
                        onCancel={() => select(undefined)} />
                {:else if isDiamondGate(evaluatingGate)}
                    <DiamondGateEvaluator
                        level={evaluatingGate.level}
                        lifetime={false}
                        onCredentialReceived={credentialReceived}
                        onCancel={() => select(undefined)} />
                {/if}
            {:else if evaluation.gate !== undefined}
                {@const gate = evaluation.gate}
                <div class="header">
                    <div class="icon">
                        <VectorCombine size={$iconSize} color={"var(--txt)"} />
                    </div>
                    <p class="title">
                        <Translatable resourceKey={i18nKey("joinGroup", undefined, gate.level)} />
                        {gate.collectionName}
                    </p>
                </div>
                {#if isCompositeGate(gate)}
                    <p class="subtitle">
                        <Translatable
                            resourceKey={gate.operator === "or"
                                ? i18nKey("access.chooseOneGateInfo")
                                : i18nKey("To join you will need to satisfy ALL access gates.")} />
                    </p>
                {/if}

                {#each evaluation.leaves as leaf (leaf.originalIndex)}
                    <div class="leaf">
                        <div class="summary">
                            <AccessGateSummary
                                editable={false}
                                level={leaf.level}
                                showNoGate={false}
                                gateConfig={{ expiry: undefined, gate: leaf }} />
                        </div>
                        {#if leaf.satisfied}
                            <CheckCircle size={$iconSize} color={"var(--success)"} />
                        {:else if leaf.kind === "neuron_gate" && evaluation.needs(leaf)}
                            <Checkbox
                                id={`neuron_${leaf.originalIndex}`}
                                label={i18nKey(
                                    "I confirm that I hold a qualifying neuron. If I don't, the join will fail.",
                                )}
                                onChange={() => evaluation.confirm(leaf)} />
                        {:else if leaf.kind === "token_balance_gate"}
                            <span class="unmet">
                                <Translatable resourceKey={i18nKey("Insufficient funds")} />
                            </span>
                        {:else if canSatisfy(leaf) && evaluation.needs(leaf)}
                            <Button tiny onClick={() => select(leaf)}>
                                <Translatable resourceKey={i18nKey("access.next")} />
                            </Button>
                        {/if}
                    </div>
                {/each}
            {/if}
        </div>
    {/snippet}

    {#snippet footer()}
        <ButtonGroup>
            <Button secondary onClick={onClose}>
                <Translatable resourceKey={i18nKey("cancel")} />
            </Button>
            <Button disabled={!evaluation.complete} onClick={nextGate}>
                <Translatable resourceKey={i18nKey("access.join")} />
            </Button>
        </ButtonGroup>
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
    .leaf {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: $sp3;
        margin-bottom: $sp3;
    }
    .unmet {
        color: var(--error);
    }
</style>
