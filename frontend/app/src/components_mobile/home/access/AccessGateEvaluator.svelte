<script lang="ts">
    import {
        cryptoBalanceStore,
        currentUserStore,
        isCompositeGate,
        isCredentialGate,
        isDiamondGate,
        isLeafGate,
        isLifetimeDiamondGate,
        isNeuronGate,
        isPaymentGate,
        isUniquePersonGate,
        publish,
        type EnhancedAccessGate,
        type EnhancedLeafGate,
        type LeafGate,
        type TokenBalanceGate,
    } from "openchat-client";
    import { i18nKey } from "../../../i18n/i18n";

    import MulticolourText from "@src/components_mobile/MulticolourText.svelte";
    import { accessApprovalState } from "@src/utils/preview.svelte";
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
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import AccessGateExpiry from "./AccessGateExpiry.svelte";
    import AccessGateSummary from "./AccessGateSummary.svelte";
    import CredentialGateEvaluator from "./CredentialGateEvaluator.svelte";
    import DiamondGateEvaluator from "./DiamondGateEvaluator.svelte";
    import NeuronGateEvaluator from "./NeuronGateEvaluator.svelte";
    import PaymentGateEvaluator from "./PaymentGateEvaluator.svelte";
    import UniqueHumanGateEvaluator from "./UniqueHumanGateEvaluator.svelte";

    type SatisfiedLeafGate = EnhancedLeafGate & { satisfied: boolean; satisfiable: boolean };

    interface Props {
        gate: EnhancedAccessGate;
        onClose: () => void;
        onComplete: () => void;
    }

    let { gate, onClose, onComplete }: Props = $props();

    let flattenedGates = $state<SatisfiedLeafGate[]>(normaliseGates(gate));

    let sortedGates = $derived(flattenedGates.toSorted(orderBySatisfied));

    function orderBySatisfied(a: SatisfiedLeafGate, b: SatisfiedLeafGate): number {
        if (a.satisfied && b.satisfied) return 0;
        return a.satisfied ? -1 : 1;
    }

    $inspect(flattenedGates);
    let currentGateIndex = $state(-1);
    let satisfiedGates = $derived(sortedGates.filter((g) => g.satisfied).length);
    let compositeOr = $derived(isCompositeGate(gate) && gate.operator === "or");
    let complete = $derived(
        compositeOr ? satisfiedGates >= 1 : satisfiedGates === sortedGates.length,
    );
    let evaluatingGate = $derived<SatisfiedLeafGate>(sortedGates[currentGateIndex]);

    function normaliseGates(gate: EnhancedAccessGate): SatisfiedLeafGate[] {
        if (isCompositeGate(gate)) {
            return gate.gates.map((l) => ({
                ...l,
                level: gate.level,
                collectionName: gate.collectionName,
                expiry: gate.expiry,
                satisfied: doesUserMeetLeafGate(l),
                satisfiable: false,
            }));
        }
        if (isLeafGate(gate)) {
            return [{ ...gate, satisfied: doesUserMeetLeafGate(gate), satisfiable: false }];
        }
        return [];
    }

    function doesUserMeetLeafGate(gate: LeafGate): boolean {
        if (gate.kind === "diamond_gate") {
            return $currentUserStore.diamondStatus.kind !== "inactive";
        } else if (gate.kind === "lifetime_diamond_gate") {
            return $currentUserStore.diamondStatus.kind === "lifetime";
        } else if (gate.kind === "unique_person_gate") {
            return $currentUserStore.isUniquePerson;
        } else if (gate.kind === "chit_earned_gate") {
            return $currentUserStore.totalChitEarned >= gate.minEarned;
        } else if (gate.kind === "token_balance_gate") {
            return doesUserMeetBalanceGate(gate);
        } else {
            return false;
        }
    }

    function doesUserMeetBalanceGate(gate: TokenBalanceGate): boolean {
        const balance = $cryptoBalanceStore.get(gate.ledgerCanister) ?? 0n;
        const liveBalance = accessApprovalState.balanceAfterCurrentCommitments(
            gate.ledgerCanister,
            balance,
        );
        return liveBalance >= gate.minBalance;
    }

    function selectGate(idx: number) {
        transition(["fade"], () => {
            currentGateIndex = idx;
        });
    }

    function cancelGate() {
        transition(["fade"], () => {
            currentGateIndex = -1;
        });
    }

    function refreshBalanceGates() {
        flattenedGates = flattenedGates.map((g) => {
            if (g.kind === "token_balance_gate") {
                g.satisfied = doesUserMeetBalanceGate(g);
            }
            return g;
        });
    }

    function confirmNeuronGate() {
        if (evaluatingGate !== undefined) {
            evaluatingGate.satisfied = true;
            onBack();
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
        // TODO problem is that topping up a token can cause gates to be spontaneously satisfied
        // This is not accounted for an it's difficult to account for.
        if (evaluatingGate !== undefined) {
            accessApprovalState.addPaymentApproval({ ledger, amount, approvalFee });
            evaluatingGate.satisfied = true;
            refreshBalanceGates();
            onBack();
        }
    }

    function credentialReceived(cred: string) {
        if (evaluatingGate !== undefined) {
            evaluatingGate.satisfied = true;
            accessApprovalState.addCredential(cred);
            refreshBalanceGates();
            onBack();
        }
    }

    function onBack() {
        if (evaluatingGate !== undefined) {
            selectGate(-1);
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
                    gate={evaluatingGate}
                    level={evaluatingGate.level}
                    {onApprovePayment}
                    onClose={cancelGate} />
            {:else if isNeuronGate(evaluatingGate)}
                <NeuronGateEvaluator
                    gate={evaluatingGate}
                    onClose={cancelGate}
                    onApprove={confirmNeuronGate} />
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
            {@const or = gate.operator === "or"}
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
                                        colour: "warning",
                                    },
                                ]} />
                        {/if}
                    </Body>
                    <Body width={"hug"} colour={"textSecondary"}>
                        <AccessGateExpiry expiry={gate.expiry} />
                    </Body>
                </Row>
            </Column>
            <Column gap={"md"}>
                {#each sortedGates as subgate, i}
                    <AccessGateSummary
                        satisfied={subgate.satisfied}
                        onClick={() => selectGate(i)}
                        gate={subgate} />
                {/each}
            </Column>

            <BodySmall align={"center"} fontWeight={"bold"}>
                <MulticolourText
                    parts={[
                        {
                            text: i18nKey("You current satisfy "),
                            colour: "textSecondary",
                        },
                        {
                            text: i18nKey(`${satisfiedGates} out of ${sortedGates.length}`),
                            colour: "primary",
                        },
                        {
                            text: i18nKey(" gates."),
                            colour: "textSecondary",
                        },
                    ]} />
            </BodySmall>
            <Column crossAxisAlignment={"center"} gap={"md"}>
                <Button disabled={!complete} onClick={onComplete}>
                    <Translatable resourceKey={i18nKey("Join")} />
                </Button>
                <CommonButton onClick={onClose} width={"hug"} mode={"active"} size={"small_text"}>
                    <Translatable resourceKey={i18nKey("cancel")} />
                </CommonButton>
            </Column>
        {/if}
    </Column>
</SlidingPageContent>
