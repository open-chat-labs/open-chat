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
        Option,
        Search,
        Select2,
        Subtitle,
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
    let searching = $state(false);
    let searchTerm = $state<string>();
    let filteredBindings = $derived(
        bindings.filter(
            (b) =>
                searchTerm === undefined ||
                searchTerm === "" ||
                b.label.toLocaleLowerCase().includes(searchTerm?.toLocaleLowerCase()),
        ),
    );
    let selectedNervousSystem = $state(initialBinding());
    let candidateTokenDetails = $derived(client.getTokenDetailsForAccessGate(gate));
    let minDissolveDelay = $state(client.getMinDissolveDelayDays(gate)?.toString() ?? "");
    let minStake = $state(client.getMinStakeInTokens(gate)?.toString() ?? "");
    let invalidDissolveDelay = $derived(minDissolveDelay !== "" && isNaN(Number(minDissolveDelay)));
    let invalidMinStake = $derived(minStake !== "" && isNaN(Number(minStake)));
    let valid = $derived(
        !(invalidDissolveDelay || invalidMinStake || selectedNervousSystem === undefined),
    );

    function initialBinding() {
        return bindings.find((b) => b.gate.governanceCanister === gate.governanceCanister);
    }

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
            selectedNervousSystem?.gate?.governanceCanister !== gate.governanceCanister
        ) {
            updateOrAddGate({
                kind: "neuron_gate",
                governanceCanister: selectedNervousSystem?.gate?.governanceCanister ?? "",
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
        // nervousSystemKey = key;
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
                <Select2
                    onSelect={(val) => {
                        selectedNervousSystem = val;
                        updateGate();
                    }}
                    placeholder={"Choose one of the available nervous systems"}
                    value={selectedNervousSystem}>
                    {#snippet selectedValue(val)}
                        {val.label}
                    {/snippet}
                    {#snippet selectOptions(onSelect)}
                        <Container
                            height={{ kind: "fixed", size: "100%" }}
                            padding={"lg"}
                            gap={"lg"}
                            direction={"vertical"}>
                            <Subtitle fontWeight={"bold"}>
                                <Translatable resourceKey={i18nKey("Choose nervous system")}
                                ></Translatable>
                            </Subtitle>

                            <Search
                                {searching}
                                id={"search_component"}
                                placeholder={$_("search")}
                                bind:value={searchTerm} />

                            <Container
                                supplementalClass={"nervous_system_options"}
                                direction={"vertical"}>
                                {#each filteredBindings as g}
                                    <Option
                                        disabled={!g.enabled}
                                        value={g}
                                        onClick={onSelect}
                                        selected={selectedNervousSystem?.key === g.key}>
                                        {g.label}
                                    </Option>
                                {/each}
                            </Container>
                        </Container>
                    {/snippet}
                    {#snippet subtext()}
                        <Translatable
                            resourceKey={i18nKey("Choose one of the available nervous systems")}
                        ></Translatable>
                    {/snippet}
                </Select2>

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

<style lang="scss">
    // this is a bit unfortunate
    :global(.container.nervous_system_options) {
        flex: auto !important;
    }
</style>
