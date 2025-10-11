<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { getGateBindings, type GateBinding } from "@src/utils/access";
    import { Body, BodySmall, Chip, CommonButton, Container, Input, Switch } from "component-lib";
    import { currentUserStore, isCompositeGate, publish, type AccessGate } from "openchat-client";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import DiamondOutline from "svelte-material-icons/DiamondOutline.svelte";
    import Plus from "svelte-material-icons/Plus.svelte";
    import MulticolourText from "../../../MulticolourText.svelte";
    import Setting from "../../../Setting.svelte";
    import SparkleBox from "../../../SparkleBox.svelte";
    import Translatable from "../../../Translatable.svelte";
    import SlidingPageContent from "../../SlidingPageContent.svelte";
    import { updateGroupState } from "../group.svelte";
    import GroupCard from "../GroupCard.svelte";

    let ugs = updateGroupState;

    let diamond = $derived($currentUserStore.diamondStatus.kind !== "inactive");
    let hasAccessGates = $derived(ugs.gateConfig.gate.kind !== "no_gate");
    let gateBindings: GateBinding[] = getGateBindings(ugs.candidateGroup.level).filter(
        (b) => b.enabled && b.gate.kind !== "no_gate" && b.gate.kind !== "credential_gate",
    );
    // svelte-ignore state_referenced_locally
    let expiryEnabled = $state(ugs.gateConfig.expiry !== undefined);
    let evaluationDays = $state(initialEvaluationDays());

    function initialEvaluationDays() {
        if (ugs.gateConfig.expiry === undefined) return undefined;
        return Math.floor(Number(ugs.gateConfig.expiry) / 1000 / 60 / 60 / 24).toString();
    }

    function toggleEvaluationInterval() {
        expiryEnabled = !expiryEnabled;
    }

    function clickGate(gate: AccessGate, active: boolean) {
        switch (gate.kind) {
            case "neuron_gate":
                publish("updateGroupNeuronGates");
                break;
            case "payment_gate":
                console.log("TODO");
                break;
            case "token_balance_gate":
                console.log("TODO");
                break;
            default:
                ugs.toggleGate(gate, active);
        }
    }

    $effect(() => {
        if (!expiryEnabled || evaluationDays === "" || evaluationDays === undefined) {
            ugs.gateConfig.expiry = undefined;
            return;
        }
        const days = Number(evaluationDays);
        if (isNaN(days)) return;

        const ms = days * 24 * 60 * 60 * 1000;
        ugs.gateConfig.expiry = BigInt(ms);
    });
</script>

<SlidingPageContent title={i18nKey("Access gates")}>
    <Container
        supplementalClass={"group_general_setup"}
        height={{ kind: "fill" }}
        gap={"xl"}
        direction={"vertical"}
        padding={["xxl", "lg", "lg", "lg"]}>
        <GroupCard candidateGroup={ugs.candidateGroup} />

        <Container padding={["zero", "md"]} gap={"sm"} direction={"vertical"}>
            <Container>
                <Body colour={diamond ? "textPrimary" : "textTertiary"} fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Access gates")}></Translatable>
                </Body>
                <CommonButton
                    onClick={() => publish("updateGroupGatesLearnMore")}
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
                        {@const active = ugs.isGateActive(gate.gate)}
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
                    error={ugs.gateConfig.expiry === undefined}
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
                    disabled={!isCompositeGate(ugs.gateConfig.gate)}
                    toggle={() => ugs.toggleOperator()}
                    info={"When enabled, users joining your group will need to satisfy at least one of your defined gates. If left disabled users will have to satisfy all of your defined access gates."}
                    title={"Require any access gate"}>
                    <Switch
                        onChange={() => ugs.toggleOperator()}
                        disabled={!isCompositeGate(ugs.gateConfig.gate)}
                        checked={isCompositeGate(ugs.gateConfig.gate) &&
                            ugs.gateConfig.gate.operator === "and"} />
                </Setting>
            </Container>
        {/if}

        <Container padding={["xl", "zero", "zero", "zero"]} mainAxisAlignment={"end"}>
            <CommonButton
                onClick={() => publish("closeModalPage")}
                mode="active"
                size={"small_text"}>
                {#snippet icon(color)}
                    <ArrowLeft {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Done, go back")}></Translatable>
            </CommonButton>
        </Container>
    </Container>
</SlidingPageContent>
