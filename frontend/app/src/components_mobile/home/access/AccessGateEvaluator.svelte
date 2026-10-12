<script lang="ts">
    import {
        isBalanceGate,
        isCompositeGate,
        isDiamondGate,
        isLifetimeDiamondGate,
        isNeuronGate,
        isPaymentGate,
        isUniquePersonGate,
        publish,
        type EnhancedAccessGate,
    } from "@client";
    import { i18nKey } from "../../../i18n/i18n";

    import MulticolourText from "@src/components_mobile/MulticolourText.svelte";
    import type {
        EvaluatedLeafGate,
        GateEvaluation,
    } from "@shared_components/home/access/gateEvaluation.svelte";
    import {
        Body,
        BodySmall,
        Button,
        ColourVars,
        Column,
        CommonButton,
        H2,
        Row,
        transition,
    } from "component-lib";
    import ShieldStar from "svelte-material-icons/ShieldStarOutline.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import AccessGateExpiry from "@shared_components/home/access/AccessGateExpiry.svelte";
    import AccessGateSummary from "./AccessGateSummary.svelte";
    import BalanceGateEvaluator from "./BalanceGateEvaluator.svelte";
    import DiamondGateEvaluator from "./DiamondGateEvaluator.svelte";
    import NeuronGateEvaluator from "./NeuronGateEvaluator.svelte";
    import PaymentGateEvaluator from "./PaymentGateEvaluator.svelte";
    import UniqueHumanGateEvaluator from "./UniqueHumanGateEvaluator.svelte";

    interface Props {
        gate: EnhancedAccessGate;
        evaluation: GateEvaluation;
        onClose: () => void;
        onComplete: () => void;
    }

    let { gate, evaluation, onClose, onComplete }: Props = $props();

    // originalIndex of the leaf the user is satisfying
    let selected = $state<number>();
    let evaluatingGate = $derived(evaluation.leaves.find((g) => g.originalIndex === selected));

    function selectGate(leaf: EvaluatedLeafGate | undefined) {
        transition(["fade"], () => {
            selected = leaf?.originalIndex;
        });
    }

    function cancelGate() {
        selectGate(undefined);
    }

    function confirmNeuronGate() {
        if (evaluatingGate !== undefined) {
            evaluation.confirm(evaluatingGate);
            onBack();
        }
    }

    function onApprovePayment(approval: { ledger: string; amount: bigint; approvalFee: bigint }) {
        // TODO problem is that topping up a token can cause gates to be spontaneously satisfied
        // This is not accounted for an it's difficult to account for.
        if (evaluatingGate !== undefined) {
            evaluation.approvePayment(evaluatingGate, approval);
            onBack();
        }
    }

    function credentialReceived(cred: string) {
        if (evaluatingGate !== undefined) {
            evaluation.addCredential(evaluatingGate, cred);
            onBack();
        }
    }

    function onBack() {
        if (evaluatingGate !== undefined) {
            selectGate(undefined);
        } else {
            publish("closeModalPage");
        }
    }
</script>

<SlidingPageContent
    {onBack}
    title={i18nKey("joinGroup", undefined, gate.level)}
    subtitle={i18nKey(gate.collectionName)}>
    <Column gap={"xl"} padding={"xl"}>
        {#if evaluatingGate !== undefined}
            {#if isUniquePersonGate(evaluatingGate)}
                <UniqueHumanGateEvaluator
                    onCredentialReceived={credentialReceived}
                    {onClose}
                    expiry={evaluatingGate.expiry}
                    level={evaluatingGate.level} />
            {:else if isPaymentGate(evaluatingGate)}
                <PaymentGateEvaluator
                    {evaluation}
                    gate={evaluatingGate}
                    level={evaluatingGate.level}
                    {onApprovePayment}
                    onClose={cancelGate} />
            {:else if isNeuronGate(evaluatingGate)}
                <NeuronGateEvaluator
                    gate={evaluatingGate}
                    onClose={cancelGate}
                    onApprove={confirmNeuronGate} />
            {:else if isBalanceGate(evaluatingGate)}
                <BalanceGateEvaluator {evaluation} gate={evaluatingGate} onClose={cancelGate} />
            {:else if isLifetimeDiamondGate(evaluatingGate)}
                <DiamondGateEvaluator
                    onCancel={cancelGate}
                    lifetime
                    onCredentialReceived={credentialReceived} />
            {:else if isDiamondGate(evaluatingGate)}
                <DiamondGateEvaluator
                    onCancel={cancelGate}
                    lifetime={false}
                    onCredentialReceived={credentialReceived} />
            {/if}
        {:else}
            <Column gap={"lg"}>
                <ShieldStar size={"4.5rem"} color={ColourVars.primary} />
                <H2 fontWeight={"bold"}>
                    <MulticolourText
                        parts={[
                            {
                                text: i18nKey("Join the "),
                                colour: "textPrimary",
                            },
                            {
                                text: i18nKey(gate.collectionName + " "),
                                colour: "primary",
                            },
                            {
                                text: i18nKey(gate.level),
                                colour: "textPrimary",
                            },
                        ]} />
                </H2>
                <Row wrap>
                    {#if isCompositeGate(gate)}
                        {@const or = gate.operator === "or"}
                        <Body width={"hug"}>
                            {#if or}
                                <MulticolourText
                                    parts={[
                                        {
                                            text: i18nKey("To join you will need to satisfy "),
                                            colour: "textSecondary",
                                        },
                                        {
                                            text: i18nKey("at least one access gate."),
                                            colour: "secondary",
                                        },
                                    ]} />
                            {:else}
                                <MulticolourText
                                    parts={[
                                        {
                                            text: i18nKey("To join you will need to satisfy "),
                                            colour: "textSecondary",
                                        },
                                        {
                                            text: i18nKey("ALL access gates."),
                                            colour: "validationWarning",
                                        },
                                    ]} />
                            {/if}
                        </Body>
                    {/if}
                    <Body width={"hug"} colour={"textSecondary"}>
                        <AccessGateExpiry expiry={gate.expiry} />
                    </Body>
                </Row>
            </Column>
            <Column gap={"md"}>
                {#each evaluation.leaves as subgate (subgate.originalIndex)}
                    <AccessGateSummary
                        {evaluation}
                        satisfied={subgate.satisfied}
                        onClick={() => evaluation.needs(subgate) && selectGate(subgate)}
                        gate={subgate} />
                {/each}
            </Column>

            {#if isCompositeGate(gate)}
                <BodySmall align={"center"} fontWeight={"bold"}>
                    <MulticolourText
                        parts={[
                            {
                                text: i18nKey("You current satisfy "),
                                colour: "textSecondary",
                            },
                            {
                                text: i18nKey(`${evaluation.satisfiedCount} out of ${evaluation.leaves.length}`),
                                colour: "primary",
                            },
                            {
                                text: i18nKey(" gates."),
                                colour: "textSecondary",
                            },
                        ]} />
                </BodySmall>
            {/if}
            <Column crossAxisAlignment={"center"} gap={"md"}>
                <Button disabled={!evaluation.complete} onClick={onComplete}>
                    <Translatable resourceKey={i18nKey("Join")} />
                </Button>
                <CommonButton onClick={onClose} width={"hug"} mode={"active"} size={"small_text"}>
                    <Translatable resourceKey={i18nKey("cancel")} />
                </CommonButton>
            </Column>
        {/if}
    </Column>
</SlidingPageContent>
