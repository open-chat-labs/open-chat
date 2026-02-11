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
    } from "component-lib";
    import {
        isNeuronGate,
        nervousSystemLookup,
        OpenChat,
        publish,
        type NeuronGate,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Save from "svelte-material-icons/ContentSaveOutline.svelte";
    import Translatable from "../../Translatable.svelte";
    import type { UpdateGroupOrCommunityState } from "../groupOrCommunity.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import AboutNeuronGate from "./AboutNeuronGate.svelte";
    import SelectBinding from "./SelectBinding.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        gate: NeuronGate;
        data: UpdateGroupOrCommunityState;
    }

    let { gate, data }: Props = $props();

    const bindings = getNeuronGateBindings($nervousSystemLookup);
    let selectedBinding = $state(initialBinding());
    let candidateTokenDetails = $derived(client.getTokenDetailsForAccessGate(selectedBinding.gate));
    let minDissolveDelay = $state(client.getMinDissolveDelayDays(gate)?.toString() ?? "");
    let minStake = $state(client.getMinStakeInTokens(gate)?.toString() ?? "");
    let invalidDissolveDelay = $derived(minDissolveDelay !== "" && isNaN(Number(minDissolveDelay)));
    let invalidMinStake = $derived(minStake !== "" && isNaN(Number(minStake)));
    let valid = $derived(
        !(invalidDissolveDelay || invalidMinStake || selectedBinding === undefined),
    );

    function initialBinding() {
        return (
            bindings.find((b) => b.gate.governanceCanister === gate.governanceCanister) ??
            bindings[0]
        );
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
            selectedBinding?.gate?.governanceCanister !== gate.governanceCanister
        ) {
            updateOrAddGate({
                kind: "neuron_gate",
                governanceCanister: selectedBinding?.gate?.governanceCanister ?? "",
                minDissolveDelay: delay,
                minStakeE8s: stake,
            });

            publish("closeModalPage");
        }
    }

    function updateOrAddGate(gate: NeuronGate) {
        const match = data.findMatch(gate);
        if (match === undefined) {
            data.addLeaf(gate);
        } else if (isNeuronGate(match)) {
            match.minDissolveDelay = gate.minDissolveDelay;
            match.minStakeE8s = gate.minStakeE8s;
        }
    }

    function updateGate() {
        minDissolveDelay = "";
        minStake = "";
    }
</script>

<SlidingPageContent title={i18nKey("Provide gate values")}>
    <Container height={"fill"} gap={"lg"} direction={"vertical"} padding={["xl", "lg"]}>
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
                    <SelectBinding
                        {bindings}
                        onSelect={updateGate}
                        title={"Choose nervous system"}
                        bind:selectedBinding
                        placeholder={"Choose one of the available nervous systems"}>
                    </SelectBinding>

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
                {#snippet icon(color, size)}
                    <Save {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Save gate")}></Translatable>
            </CommonButton>
        </Container>
    </Container>
</SlidingPageContent>
