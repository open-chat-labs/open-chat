<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { getGateBindings, type GateBinding } from "@src/utils/access";
    import { Body, BodySmall, Chip, CommonButton, Container, Input, Switch } from "component-lib";
    import {
        currentUserStore,
        isCompositeGate,
        isLeafGate,
        publish,
        type AccessGate,
        type AccessGateConfig,
        type CandidateGroupChat,
        type LeafGate,
    } from "openchat-client";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import DiamondOutline from "svelte-material-icons/DiamondOutline.svelte";
    import Plus from "svelte-material-icons/Plus.svelte";
    import MulticolourText from "../../MulticolourText.svelte";
    import Setting from "../../Setting.svelte";
    import SparkleBox from "../../SparkleBox.svelte";
    import Translatable from "../../Translatable.svelte";
    import GroupCard from "./GroupCard.svelte";

    interface Props {
        candidateGroup: CandidateGroupChat;
        gateConfig: AccessGateConfig;
        onBack: () => void;
    }

    let { candidateGroup = $bindable(), onBack }: Props = $props();
    let gateConfig = $derived(candidateGroup.gateConfig);
    let diamond = $derived($currentUserStore.diamondStatus.kind !== "inactive");
    let hasAccessGates = $derived(gateConfig.gate.kind !== "no_gate");
    let gateBindings: GateBinding[] = getGateBindings(candidateGroup.level).filter(
        (b) => b.enabled && b.gate.kind !== "no_gate" && b.gate.kind !== "credential_gate",
    );
    // svelte-ignore state_referenced_locally
    let expiryEnabled = $state(gateConfig.expiry !== undefined);
    let evaluationDays = $state(initialEvaluationDays());

    function initialEvaluationDays() {
        if (gateConfig.expiry === undefined) return undefined;
        return Math.floor(Number(gateConfig.expiry) / 1000 / 60 / 60 / 24).toString();
    }

    function toggleEvaluationInterval() {
        expiryEnabled = !expiryEnabled;
    }

    function addLeaf(newGate: LeafGate) {
        if (isCompositeGate(gateConfig.gate)) {
            gateConfig.gate.gates.push(newGate);
        } else {
            if (gateConfig.gate.kind === "no_gate") {
                gateConfig.gate = newGate;
            } else {
                const oldGate = { ...gateConfig.gate };
                gateConfig.gate = {
                    kind: "composite_gate",
                    gates: [oldGate, newGate],
                    operator: "and",
                };
            }
        }
    }

    function deleteGate(gate: LeafGate) {
        if (isCompositeGate(gateConfig.gate)) {
            gateConfig.gate.gates = gateConfig.gate.gates.filter((g) => g.kind !== gate.kind);
            if (gateConfig.gate.gates.length === 1) {
                gateConfig.gate = gateConfig.gate.gates[0];
            }
        } else {
            gateConfig.gate = { kind: "no_gate" };
        }
    }

    function isGateActive(gate: AccessGate) {
        if (isLeafGate(gateConfig.gate)) {
            return gate.kind === gateConfig.gate.kind;
        }
        if (isCompositeGate(gateConfig.gate)) {
            return gateConfig.gate.gates.some((g) => g.kind === gate.kind);
        }
        return false;
    }

    function toggleGate(gate: AccessGate, active: boolean) {
        if (isLeafGate(gate)) {
            if (active) {
                deleteGate(gate);
            } else {
                addLeaf(gate);
            }
        }
    }

    function toggleOperator() {
        if (isCompositeGate(gateConfig.gate)) {
            switch (gateConfig.gate.operator) {
                case "and":
                    gateConfig.gate.operator = "or";
                    break;
                case "or":
                    gateConfig.gate.operator = "and";
                    break;
            }
        }
    }

    $effect(() => {
        if (!expiryEnabled || evaluationDays === "" || evaluationDays === undefined) {
            gateConfig.expiry = undefined;
            return;
        }
        const days = Number(evaluationDays);
        if (isNaN(days)) return;

        const ms = days * 24 * 60 * 60 * 1000;
        gateConfig.expiry = BigInt(ms);
    });
</script>

<Container
    supplementalClass={"group_general_setup"}
    height={{ kind: "fill" }}
    gap={"xl"}
    direction={"vertical"}
    padding={["xxl", "lg", "lg", "lg"]}>
    <GroupCard {candidateGroup} />

    <Container padding={["zero", "md"]} gap={"sm"} direction={"vertical"}>
        <Body colour={diamond ? "textPrimary" : "textTertiary"} fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("Access gates")}></Translatable>
        </Body>

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
                    {@const active = isGateActive(gate.gate)}
                    <Chip
                        onClick={() => toggleGate(gate.gate, active)}
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
                info={"You may choose to enforce the periodic re-evaluation of your access gates. When a member's access lapses, they will not be able to interact with the group until they have re-evaluated that the access conditions are still met."}
                title={"Access gate evaluation interval"}>
                <Switch
                    onChange={toggleEvaluationInterval}
                    disabled={!hasAccessGates}
                    checked={expiryEnabled} />
            </Setting>
        </Container>

        {#if expiryEnabled}
            <Input
                error={gateConfig.expiry === undefined}
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
                disabled={!isCompositeGate(gateConfig.gate)}
                toggle={toggleOperator}
                info={"When enabled, users joining your group will need to satisfy at least one of your defined gates. If left disabled users will have to satisfy all of your defined access gates."}
                title={"Require any access gate"}>
                <Switch
                    onChange={toggleOperator}
                    disabled={!isCompositeGate(gateConfig.gate)}
                    checked={isCompositeGate(gateConfig.gate) &&
                        gateConfig.gate.operator === "and"} />
            </Setting>
        </Container>
    {/if}

    <Container padding={["xl", "zero", "zero", "zero"]} mainAxisAlignment={"end"}>
        <CommonButton onClick={onBack} mode="active" size={"small_text"}>
            {#snippet icon(color)}
                <ArrowLeft {color} />
            {/snippet}
            <Translatable resourceKey={i18nKey("Done, go back")}></Translatable>
        </CommonButton>
    </Container>
</Container>
