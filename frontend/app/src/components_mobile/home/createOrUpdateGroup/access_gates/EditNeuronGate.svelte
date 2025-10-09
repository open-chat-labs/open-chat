<script lang="ts">
    import { i18nKey, interpolate } from "@src/i18n/i18n";
    import { getNeuronGateBindings } from "@src/utils/access";
    import {
        Body,
        BodySmall,
        ColourVars,
        CommonButton,
        Container,
        Form,
        Input,
        Select,
    } from "component-lib";
    import {
        isCompositeGate,
        isLeafGate,
        nervousSystemLookup,
        OpenChat,
        type AccessGateConfig,
        type NeuronGate,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Save from "svelte-material-icons/ContentSaveOutline.svelte";
    import Translatable from "../../../Translatable.svelte";
    import AboutNeuronGate from "./AboutNeuronGate.svelte";
    import { addLeaf } from "./access_gates.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        gateConfig: AccessGateConfig;
        gate: NeuronGate;
        onBack: () => void;
    }

    let { gateConfig = $bindable(), gate, onBack }: Props = $props();

    const bindings = getNeuronGateBindings($nervousSystemLookup);
    let nervousSystemKey = $state<string>(gate.governanceCanister);
    let candidateTokenDetails = $derived(client.getTokenDetailsForAccessGate(gate));
    let minDissolveDelay = $state(client.getMinDissolveDelayDays(gate)?.toString() ?? "");
    let minStake = $state(client.getMinStakeInTokens(gate)?.toString() ?? "");
    let invalidDissolveDelay = $derived(minDissolveDelay !== "" && isNaN(Number(minDissolveDelay)));
    let invalidMinStake = $derived(minStake !== "" && isNaN(Number(minStake)));
    let valid = $derived(
        !(
            invalidDissolveDelay ||
            invalidMinStake ||
            nervousSystemKey === "" ||
            nervousSystemKey === undefined
        ),
    );

    function save() {
        const delay =
            minDissolveDelay !== "" && !invalidDissolveDelay
                ? Number(minDissolveDelay) * 24 * 60 * 60 * 1000
                : undefined;
        const stake =
            minStake !== "" && !invalidMinStake
                ? Number(minStake) * Math.pow(10, candidateTokenDetails?.decimals ?? 8)
                : undefined;

        if (
            delay !== gate.minDissolveDelay ||
            stake !== gate.minStakeE8s ||
            nervousSystemKey !== gate.governanceCanister
        ) {
            updateOrAddGate({
                kind: "neuron_gate",
                governanceCanister: nervousSystemKey ?? "",
                minDissolveDelay: delay,
                minStakeE8s: stake,
            });

            onBack();
        }
    }

    function updateOrAddGate(gate: NeuronGate) {
        if (isCompositeGate(gateConfig.gate)) {
            const match = gateConfig.gate.gates.find(
                (g) => g.kind === "neuron_gate" && g.governanceCanister === gate.governanceCanister,
            );
            if (match && match.kind === "neuron_gate") {
                match.minDissolveDelay = gate.minDissolveDelay;
                match.minStakeE8s = gate.minStakeE8s;
            } else {
                addLeaf(gateConfig, gate);
            }
        }

        if (isLeafGate(gateConfig.gate)) {
            if (
                gateConfig.gate.kind === "neuron_gate" &&
                gateConfig.gate.governanceCanister === gate.governanceCanister
            ) {
                gateConfig.gate.minDissolveDelay = gate.minDissolveDelay;
                gateConfig.gate.minStakeE8s = gate.minStakeE8s;
            } else {
                addLeaf(gateConfig, gate);
            }
        }
    }

    function updateGate() {
        minDissolveDelay = "";
        minStake = "";
    }
</script>

<Container height={{ kind: "fill" }} gap={"lg"} direction={"vertical"} padding={["xl", "lg"]}>
    <AboutNeuronGate padding={"lg"} background={ColourVars.background1} />

    <Container gap={"xl"} direction={"vertical"}>
        <Container gap={"sm"} direction={"vertical"} padding={["zero", "sm"]}>
            <Body fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("Gate values")}></Translatable>
            </Body>

            <BodySmall colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey(
                        "Choose the relevant nervous system, and optionally minimum dissolve delay set for the neuron, and minimum amount of staked tokens.",
                    )}></Translatable>
            </BodySmall>
        </Container>

        <Form onSubmit={save}>
            <Container direction={"vertical"} gap={"xl"}>
                <Select onchange={updateGate} bind:value={nervousSystemKey}>
                    <option disabled={true} value={undefined}
                        >{"Choose one of the available nervous systems"}</option>
                    {#each bindings as g}
                        <!-- <option disabled={!g.enabled} value={g.key}>{g.label}</option> -->
                        <option value={g.key}>{g.label}</option>
                    {/each}
                    {#snippet subtext()}
                        <Translatable
                            resourceKey={i18nKey("Choose one of the available nervous systems")}
                        ></Translatable>
                    {/snippet}
                </Select>

                <Input
                    maxlength={100}
                    placeholder={interpolate($_, i18nKey("Minimum dissolve delay"))}
                    error={invalidDissolveDelay}
                    bind:value={minDissolveDelay}>
                    {#snippet subtext()}
                        <Translatable resourceKey={i18nKey("This value is optional")}
                        ></Translatable>
                    {/snippet}
                </Input>

                <Input
                    maxlength={100}
                    placeholder={interpolate($_, i18nKey("Minimum stake"))}
                    error={invalidMinStake}
                    bind:value={minStake}>
                    {#snippet subtext()}
                        <Translatable resourceKey={i18nKey("This value is optional")}
                        ></Translatable>
                    {/snippet}
                </Input>
            </Container>
        </Form>
    </Container>

    <Container mainAxisAlignment={"end"} crossAxisAlignment={"center"}>
        <CommonButton disabled={!valid} onClick={save} mode={"active"} size={"medium"}>
            {#snippet icon(color)}
                <Save {color} />
            {/snippet}
            <Translatable resourceKey={i18nKey("Save gate")}></Translatable>
        </CommonButton>
    </Container>
</Container>
