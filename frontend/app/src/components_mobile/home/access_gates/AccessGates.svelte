<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { getGateBindings, type GateBinding } from "@src/utils/access";
    import { Body, BodySmall, Chip, CommonButton, Container, Input, Switch } from "component-lib";
    import {
        currentUserStore,
        isChitEarnedGate,
        isCompositeGate,
        publish,
        type AccessGate,
    } from "openchat-client";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import DiamondOutline from "svelte-material-icons/DiamondOutline.svelte";
    import Plus from "svelte-material-icons/Plus.svelte";
    import MulticolourText from "../../MulticolourText.svelte";
    import Setting from "../../Setting.svelte";
    import SparkleBox from "../../SparkleBox.svelte";
    import Translatable from "../../Translatable.svelte";
    import { UpdateGroupState } from "../createOrUpdateGroup/group.svelte";
    import GroupCard from "../createOrUpdateGroup/GroupCard.svelte";
    import type { UpdateGroupOrCommunityState } from "../groupOrCommunity.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";

    interface Props {
        data: UpdateGroupOrCommunityState;
    }

    let { data }: Props = $props();

    let diamond = $derived($currentUserStore.diamondStatus.kind !== "inactive");
    let hasAccessGates = $derived(data.gateConfig.gate.kind !== "no_gate");
    let gateBindings: GateBinding[] = getGateBindings(data.candidate.level).filter(
        (b) => b.enabled && b.gate.kind !== "no_gate" && b.gate.kind !== "credential_gate",
    );
    // svelte-ignore state_referenced_locally
    let expiryEnabled = $state(data.gateConfig.expiry !== undefined);
    let evaluationDays = $state(initialEvaluationDays());

    function initialEvaluationDays() {
        if (data.gateConfig.expiry === undefined) return undefined;
        return Math.floor(Number(data.gateConfig.expiry) / 1000 / 60 / 60 / 24).toString();
    }

    function toggleEvaluationInterval() {
        expiryEnabled = !expiryEnabled;
    }

    function clickGate(gate: AccessGate, active: boolean) {
        switch (gate.kind) {
            case "neuron_gate":
                publish("updateNeuronGates", data);
                break;
            case "payment_gate":
                publish("updatePaymentGates", data);
                break;
            case "token_balance_gate":
                publish("updateTokenBalanceGates", data);
                break;
            case "chit_earned_gate":
                if (active) {
                    const existing =
                        data.findMatchByKind("chit_earned_gate") ?? data.defaultChitGate();
                    if (existing && isChitEarnedGate(existing)) {
                        publish("updateChitGate", { data, gate: existing });
                    }
                } else {
                    publish("updateChitGate", { data, gate: data.defaultChitGate() });
                }
                break;
            default:
                data.toggleGate(gate, active);
        }
    }

    $effect(() => {
        if (!expiryEnabled || evaluationDays === "" || evaluationDays === undefined) {
            data.gateConfig.expiry = undefined;
            return;
        }
        const days = Number(evaluationDays);
        if (isNaN(days)) return;

        const ms = days * 24 * 60 * 60 * 1000;
        data.gateConfig.expiry = BigInt(ms);
    });
</script>

<SlidingPageContent title={i18nKey("Access gates")}>
    <Container
        supplementalClass={"group_general_setup"}
        height={{ kind: "fill" }}
        gap={"xl"}
        direction={"vertical"}
        padding={["xxl", "lg", "lg", "lg"]}>
        {#if data instanceof UpdateGroupState}
            <GroupCard candidateGroup={data.candidateGroup} />
        {/if}

        <Container padding={["zero", "md"]} gap={"sm"} direction={"vertical"}>
            <Container>
                <Body colour={diamond ? "textPrimary" : "textTertiary"} fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Access gates")}></Translatable>
                </Body>
                <CommonButton
                    onClick={() => publish("accessGatesLearnMore")}
                    mode={"active"}
                    size={"small_text"}>
                    <Translatable resourceKey={i18nKey("Learn more")}></Translatable>
                </CommonButton>
            </Container>

            <BodySmall colour={diamond ? "textSecondary" : "textTertiary"}>
                <Translatable
                    resourceKey={i18nKey(
                        "Control who can join your group with a set of well defined access gates. Access gates provide a way to fine tune the profile of users you would want to have in your group. Users explicitly invited to this group will not be required to pass access gates.",
                    )}></Translatable>
            </BodySmall>
        </Container>

        {#if !diamond}
            <SparkleBox buttonText={i18nKey("Get Diamond")} onClick={() => publish("upgrade")}>
                {#snippet title()}
                    <MulticolourText
                        parts={[
                            {
                                text: i18nKey("Upgrade to "),
                                colour: "primaryLight",
                            },
                            {
                                text: i18nKey("Diamond"),
                                colour: "secondary",
                            },
                        ]} />
                {/snippet}
                {#snippet body()}
                    <MulticolourText
                        parts={[
                            {
                                text: i18nKey("Only diamond members can add access gates."),
                                colour: "primaryLight",
                            },
                            {
                                text: i18nKey("Join now!"),
                                colour: "textPrimary",
                            },
                        ]} />
                {/snippet}
                {#snippet buttonIcon(color)}
                    <DiamondOutline {color} />
                {/snippet}
            </SparkleBox>
        {:else}
            <Container padding={["zero", "md"]} gap={"xl"} direction={"vertical"}>
                <Container padding={["zero", "zero", "xl", "zero"]} wrap gap={"sm"}>
                    {#each gateBindings as gate}
                        {@const active = data.isGateActive(gate.gate)}
                        <Chip
                            onClick={() => clickGate(gate.gate, active)}
                            mode={active ? "filter" : "default"}>
                            {#snippet icon(color)}
                                {#if active}
                                    <Check {color} />
                                {:else}
                                    <Plus {color} />
                                {/if}
                            {/snippet}
                            <Translatable resourceKey={i18nKey(gate.label)}></Translatable>
                        </Chip>
                    {/each}
                </Container>
                <Setting
                    disabled={!hasAccessGates}
                    toggle={toggleEvaluationInterval}
                    info={"You may choose to enforce the periodic re-evaluation of your access gates. When a member's access lapses, they will not be able to interact with the group until they have re-evaluated that the access conditions are still met."}>
                    <Switch
                        reverse
                        onChange={toggleEvaluationInterval}
                        disabled={!hasAccessGates}
                        checked={expiryEnabled}>
                        <Translatable resourceKey={i18nKey("Access gate evaluation interval")}
                        ></Translatable>
                    </Switch>
                </Setting>
            </Container>

            {#if expiryEnabled}
                <Input
                    error={data.gateConfig.expiry === undefined}
                    bind:value={evaluationDays}
                    placeholder={"Evaluation interval"}>
                    {#snippet subtext()}
                        <Translatable
                            resourceKey={i18nKey(
                                "Please provide the number of days after which the access gates will be re-evaluated.",
                            )}></Translatable>
                    {/snippet}
                </Input>
            {/if}
            <Container padding={["zero", "md"]} gap={"xl"} direction={"vertical"}>
                <Setting
                    disabled={!isCompositeGate(data.gateConfig.gate)}
                    toggle={() => data.toggleOperator()}
                    info={"When enabled, users joining your group will need to satisfy at least one of your defined gates. If left disabled users will have to satisfy all of your defined access gates."}>
                    <Switch
                        reverse
                        onChange={() => data.toggleOperator()}
                        disabled={!isCompositeGate(data.gateConfig.gate)}
                        checked={isCompositeGate(data.gateConfig.gate) &&
                            data.gateConfig.gate.operator === "and"}>
                        <Translatable resourceKey={i18nKey("Require any access gate")}
                        ></Translatable>
                    </Switch>
                </Setting>
            </Container>
        {/if}

        <Container padding={["xl", "zero", "zero", "zero"]} mainAxisAlignment={"end"}>
            <CommonButton onClick={() => publish("closeModalPage")} mode="active" size={"medium"}>
                {#snippet icon(color)}
                    <ArrowLeft {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Done, go back")}></Translatable>
            </CommonButton>
        </Container>
    </Container>
</SlidingPageContent>
