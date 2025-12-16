<script lang="ts">
    import {
        currentUserStore,
        isCompositeGate,
        isCredentialGate,
        isDiamondGate,
        isLeafGate,
        isLifetimeDiamondGate,
        isPaymentGate,
        isUniquePersonGate,
        OpenChat,
        type EnhancedAccessGate,
        type EnhancedLeafGate,
        type PaymentGateApprovals,
    } from "openchat-client";
    import { i18nKey } from "../../../i18n/i18n";

    import MulticolourText from "@src/components_mobile/MulticolourText.svelte";
    import {
        Body,
        Button,
        ColourVars,
        Column,
        CommonButton,
        H2,
        Row,
        transition,
    } from "component-lib";
    import { getContext } from "svelte";
    import ShieldStar from "svelte-material-icons/ShieldStarOutline.svelte";
    import Translatable from "../../Translatable.svelte";
    import AccessGateExpiry from "./AccessGateExpiry.svelte";
    import AccessGateSummary from "./AccessGateSummary.svelte";
    import CredentialGateEvaluator from "./CredentialGateEvaluator.svelte";
    import DiamondGateEvaluator from "./DiamondGateEvaluator.svelte";
    import PaymentGateEvaluator from "./PaymentGateEvaluator.svelte";
    import UniqueHumanGateEvaluator from "./UniqueHumanGateEvaluator.svelte";

    const client = getContext<OpenChat>("client");

    type SatisfiedLeafGate = EnhancedLeafGate & { satisfied: boolean; satisfiable: boolean };

    interface Props {
        gate: EnhancedAccessGate;
        onClose: () => void;
        paymentApprovals: PaymentGateApprovals;
        credentials: string[];
        onComplete: () => void;
    }

    let { gate, onClose, paymentApprovals, credentials, onComplete }: Props = $props();

    let flattenedGates = $state<SatisfiedLeafGate[]>(normaliseGates(gate));
    let currentGateIndex = $state(-1);
    let satisfiedGates = $derived(flattenedGates.filter((g) => g.satisfied).length);
    let compositeOr = $derived(isCompositeGate(gate) && gate.operator === "or");
    let complete = $derived(
        compositeOr ? satisfiedGates >= 1 : satisfiedGates === flattenedGates.length,
    );
    let levelString = $derived.by(() => {
        switch (gate.level) {
            case "channel":
                return "Channel";
            case "community":
                return "Community";
            case "group":
                return "Group";
        }
    });

    $inspect(flattenedGates, $currentUserStore.diamondStatus.kind);

    function normaliseGates(gate: EnhancedAccessGate): SatisfiedLeafGate[] {
        if (isCompositeGate(gate)) {
            return gate.gates.map((l) => ({
                ...l,
                level: gate.level,
                expiry: gate.expiry,
                satisfied: client.doesUserMeetAccessGate(l),
                satisfiable: false,
            }));
        }
        if (isLeafGate(gate)) {
            return [
                { ...gate, satisfied: client.doesUserMeetAccessGate(gate), satisfiable: false },
            ];
        }
        return [];
    }

    let evaluatingGate = $derived<SatisfiedLeafGate>(flattenedGates[currentGateIndex]);

    function nextGate() {
        transition(["fade"], () => {
            if (complete) {
                onComplete();
            } else {
                currentGateIndex = flattenedGates.findIndex((g) => !g.satisfied);
            }
        });
    }

    function cancelGate() {
        transition(["fade"], () => {
            currentGateIndex = -1;
        });
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
        if (evaluatingGate !== undefined) {
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
            evaluatingGate.satisfied = true;
            nextGate();
        }
    }

    function credentialReceived(cred: string) {
        if (evaluatingGate !== undefined) {
            evaluatingGate.satisfied = true;
            credentials.push(cred);
            nextGate();
        }
    }
</script>

<Column gap={"xl"} padding={"xl"}>
    {#if evaluatingGate !== undefined}
        {#if isCredentialGate(evaluatingGate)}
            <CredentialGateEvaluator
                {onClose}
                onCredentialReceived={credentialReceived}
                gate={evaluatingGate}
                level={evaluatingGate.level} />
        {:else if isUniquePersonGate(evaluatingGate)}
            <UniqueHumanGateEvaluator
                onCredentialReceived={credentialReceived}
                {onClose}
                expiry={evaluatingGate.expiry}
                level={evaluatingGate.level} />
        {:else if isPaymentGate(evaluatingGate)}
            <PaymentGateEvaluator
                {paymentApprovals}
                gate={evaluatingGate}
                level={evaluatingGate.level}
                {onApprovePayment}
                onClose={cancelGate} />
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
    {:else if isCompositeGate(gate)}
        {#if gate.operator === "or"}
            <Column gap={"lg"}>
                <ShieldStar size={"4.5rem"} color={ColourVars.primary} />
                <H2 fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Choose how to join")} />
                </H2>
                <Row wrap>
                    <Body width={"hug"}>
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
                    <Body width={"hug"} colour={"textSecondary"}>
                        <AccessGateExpiry expiry={gate.expiry} />
                    </Body>
                </Row>
            </Column>
            <Column gap={"md"}>
                {#each flattenedGates as subgate, i}
                    <AccessGateSummary
                        satisfied={subgate.satisfied}
                        onClick={() => (currentGateIndex = i)}
                        gate={subgate} />
                {/each}
            </Column>
        {:else}
            <Column gap={"lg"}>
                <ShieldStar size={"4.5rem"} color={ColourVars.primary} />
                <H2 fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey(`${levelString} access gates`)} />
                </H2>
                <Row wrap>
                    <Body width={"hug"}>
                        <MulticolourText
                            parts={[
                                {
                                    text: i18nKey("To join you will need to satisfy "),
                                    colour: "textSecondary",
                                },
                                {
                                    text: i18nKey("ALL access gates."),
                                    colour: "secondary",
                                },
                            ]} />
                    </Body>
                    <Body width={"hug"} colour={"textSecondary"}>
                        <AccessGateExpiry expiry={gate.expiry} />
                    </Body>
                </Row>
            </Column>
            <Column gap={"md"}>
                {#each flattenedGates as subgate}
                    <AccessGateSummary
                        satisfied={subgate.satisfied}
                        onClick={nextGate}
                        gate={subgate} />
                {/each}
            </Column>
            <Button onClick={nextGate}>
                <Translatable resourceKey={i18nKey("Let's go")} />
            </Button>
        {/if}
        <Row mainAxisAlignment={"center"}>
            <CommonButton width={"hug"} onClick={onClose} size={"small_text"}>
                <Translatable resourceKey={i18nKey("cancel")} />
            </CommonButton>
        </Row>
    {/if}
</Column>
