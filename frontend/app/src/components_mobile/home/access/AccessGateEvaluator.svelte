<script lang="ts">
    import {
        isCompositeGate,
        isCredentialGate,
        isDiamondGate,
        isLeafGate,
        isLifetimeDiamondGate,
        isPaymentGate,
        isUniquePersonGate,
        OpenChat,
        shouldPreprocessGate,
        type EnhancedAccessGate,
        type GateCheckSucceeded,
        type LeafGate,
        type PaymentGateApprovals,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";

    import MulticolourText from "@src/components_mobile/MulticolourText.svelte";
    import { Body, Button, ColourVars, Column, CommonButton, H2, Row } from "component-lib";
    import Diamond from "svelte-material-icons/DiamondOutline.svelte";
    import ShieldStar from "svelte-material-icons/ShieldStarOutline.svelte";
    import Translatable from "../../Translatable.svelte";
    import AccessGateSummary from "./AccessGateSummary.svelte";
    import CredentialGateEvaluator from "./CredentialGateEvaluator.svelte";
    import DiamondGateEvaluator from "./DiamondGateEvaluator.svelte";
    import PaymentGateEvaluator from "./PaymentGateEvaluator.svelte";
    import UniqueHumanGateEvaluator from "./UniqueHumanGateEvaluator.svelte";

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

    function onApprovePayment({
        ledger,
        amount,
        approvalFee,
    }: {
        ledger: string;
        amount: bigint;
        approvalFee: bigint;
    }) {
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

    function credentialReceived(cred: string) {
        credentials.push(cred);
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

<Column gap={"xl"} padding={"xl"}>
    {#if currentGate}
        {#if isCompositeGate(currentGate) && currentGate.operator === "or"}
            <Column gap={"lg"}>
                <ShieldStar size={"4.5rem"} color={ColourVars.primary} />
                <H2 fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Choose how to join")} />
                </H2>
                <Body>
                    <MulticolourText
                        parts={[
                            {
                                text: i18nKey("To join you will need to satisfy "),
                                colour: "textSecondary",
                            },
                            {
                                text: i18nKey("at least one access gate."),
                                colour: "warning",
                            },
                        ]} />
                </Body>
            </Column>
            {#each currentGate.gates as subgate, i}
                <AccessGateSummary
                    onClick={() => {
                        toggleIndex(i, currentGate);
                        nextGate();
                    }}
                    gate={subgate} />
            {/each}
            <Row mainAxisAlignment={"center"}>
                <CommonButton width={"hug"} onClick={onClose} size={"small_text"}>
                    <Translatable resourceKey={i18nKey("cancel")} />
                </CommonButton>
            </Row>
        {:else if isCredentialGate(currentGate)}
            <CredentialGateEvaluator
                {onClose}
                onCredentialReceived={credentialReceived}
                gate={currentGate}
                level={currentGate.level} />
        {:else if isUniquePersonGate(currentGate)}
            <UniqueHumanGateEvaluator
                onCredentialReceived={credentialReceived}
                {onClose}
                expiry={currentGate.expiry}
                level={currentGate.level} />
        {:else if isPaymentGate(currentGate)}
            <PaymentGateEvaluator
                {paymentApprovals}
                gate={currentGate}
                level={currentGate.level}
                {onApprovePayment}
                {onClose} />
        {:else if isLifetimeDiamondGate(currentGate)}
            <DiamondGateEvaluator
                onCancel={onClose}
                lifetime
                onCredentialReceived={credentialReceived} />
        {:else if isDiamondGate(currentGate)}
            <DiamondGateEvaluator
                onCancel={onClose}
                lifetime={false}
                onCredentialReceived={credentialReceived} />
        {/if}
    {/if}

    <Row mainAxisAlignment={"center"}>
        {#if currentGate !== undefined}
            {#if isCompositeGate(currentGate) && currentGate.operator === "and"}
                <Button disabled={optionalInvalid} onClick={nextGate}>
                    {#snippet icon(color)}
                        <Diamond {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("access.next")} />
                </Button>
            {/if}
        {:else}
            <Button onClick={onClose}>
                {#snippet icon(color)}
                    <Diamond {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("access.join")} />
            </Button>
        {/if}
    </Row>
</Column>

<!-- <ModalContent
    hideFooter={currentGate !== undefined && currentGate.kind !== "composite_gate"}
    closeIcon
    {onClose}>

    {#snippet footer()}
    {/snippet}
</ModalContent> -->

<style lang="scss">
    .optional-gate {
        margin-bottom: $sp3;
    }
</style>
