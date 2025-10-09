<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import {
        Avatar,
        Body,
        BodySmall,
        Caption,
        ColourVars,
        CommonButton,
        Container,
        IconButton,
        Label,
        MenuItem,
        MenuTrigger,
    } from "component-lib";
    import {
        isCompositeGate,
        isLeafGate,
        OpenChat,
        type CandidateGroupChat,
        type NeuronGate,
    } from "openchat-client";
    import { getContext } from "svelte";
    import Delete from "svelte-material-icons/DeleteForeverOutline.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import Plus from "svelte-material-icons/Plus.svelte";
    import Edit from "svelte-material-icons/TextBoxEditOutline.svelte";
    import Translatable from "../../../Translatable.svelte";
    import AboutNeuronGate from "./AboutNeuronGate.svelte";
    import { defaultNeuronGate, deleteGate } from "./access_gates.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        candidateGroup: CandidateGroupChat;
        onAddNeuronGate: (gate: NeuronGate) => void;
    }

    let { candidateGroup = $bindable(), onAddNeuronGate }: Props = $props();
    let gateConfig = $derived(candidateGroup.gateConfig);

    let neuronGates = $derived.by<NeuronGate[]>(() => {
        if (isLeafGate(gateConfig.gate)) {
            if (gateConfig.gate.kind === "neuron_gate") {
                return [gateConfig.gate];
            }
        }
        if (isCompositeGate(gateConfig.gate)) {
            return gateConfig.gate.gates.filter((g) => g.kind === "neuron_gate");
        }
        return [];
    });

    function gateSubtext(gate: NeuronGate): string | undefined {
        const dissolveDelayDays = client.getMinDissolveDelayDays(gate);
        const minStake = client.getMinStakeInTokens(gate);
        const parts: string[] = [];
        if (dissolveDelayDays !== undefined) {
            parts.push(`${dissolveDelayDays}d dissolve delay`);
        }
        if (minStake !== undefined) {
            parts.push(`${minStake} token stake`);
        }
        return parts.join(" / ");
    }

    function removeAll() {
        neuronGates.forEach((g) => deleteGate(gateConfig, g));
    }

    function menuOpened(trigger: HTMLElement) {
        const rect = trigger.getBoundingClientRect();
        const mask = document.getElementById("mask-hole");
        mask?.setAttribute("x", rect.left.toString());
        mask?.setAttribute("y", rect.top.toString());
        mask?.setAttribute("width", rect.width.toString());
        mask?.setAttribute("height", rect.height.toString());
        mask?.setAttribute("rx", "8px");
        mask?.setAttribute("ry", "8px");
    }
</script>

<Container
    supplementalClass={"neuron_gate_list"}
    height={{ kind: "fill" }}
    gap={"lg"}
    direction={"vertical"}
    padding={["xl", "lg"]}>
    <AboutNeuronGate padding={"lg"} background={ColourVars.background1} />

    {#if neuronGates.length > 0}
        <Container gap={"xl"} direction={"vertical"}>
            <Container gap={"sm"} direction={"vertical"} padding={["zero", "sm"]}>
                <Body fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Existing neuron holder gates")}
                    ></Translatable>
                </Body>

                <BodySmall colour={"textSecondary"}>
                    <Translatable
                        resourceKey={i18nKey(
                            "You may add multiple neuron holder gates for your group. Tap on any to access the edit / remove actions.",
                        )}></Translatable>
                </BodySmall>
            </Container>
            <Container gap={"md"} direction={"vertical"}>
                {#each neuronGates as gate}
                    {@const token = client.getTokenDetailsForAccessGate(gate)}
                    <MenuTrigger
                        onOpen={menuOpened}
                        classString={"neuron_gate_menu_trigger"}
                        fill
                        position={"bottom"}
                        align={"end"}>
                        <Container
                            supplementalClass={"neuron_gate_list_item"}
                            crossAxisAlignment={"center"}
                            borderColour={ColourVars.background2}
                            borderWidth={"thick"}
                            gap={"md"}
                            padding={"md"}
                            borderRadius={"md"}>
                            <Avatar
                                size={"sm"}
                                url={token?.logo ?? "/assets/access_gate/neuron.svg"} />

                            <Container direction={"vertical"}>
                                {#if token !== undefined}
                                    <Label fontWeight={"bold"}>{token.name}</Label>
                                {/if}
                                <Caption colour={"textSecondary"}>{gateSubtext(gate)}</Caption>
                            </Container>

                            <IconButton size={"md"}>
                                {#snippet icon()}
                                    <DotsVertical color={ColourVars.textSecondary} />
                                {/snippet}
                            </IconButton>
                        </Container>
                        {#snippet menuItems()}
                            <MenuItem onclick={() => onAddNeuronGate(gate)}>
                                {#snippet icon(color)}
                                    <Edit {color} />
                                {/snippet}
                                Edit
                            </MenuItem>
                            <MenuItem danger onclick={() => deleteGate(gateConfig, gate)}>
                                {#snippet icon(color)}
                                    <Delete {color} />
                                {/snippet}
                                Remove
                            </MenuItem>
                        {/snippet}
                    </MenuTrigger>
                {/each}
            </Container>
        </Container>
    {/if}

    <Container mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"center"}>
        <CommonButton onClick={removeAll} disabled={neuronGates.length === 0} size={"small_text"}>
            {#snippet icon(color)}
                <Delete {color} />
            {/snippet}
            <Translatable resourceKey={i18nKey("Remove all")}></Translatable>
        </CommonButton>
        <CommonButton
            onClick={() => onAddNeuronGate(defaultNeuronGate())}
            mode={"active"}
            size={"medium"}>
            {#snippet icon(color)}
                <Plus {color} />
            {/snippet}
            <Translatable resourceKey={i18nKey("Add gate")}></Translatable>
        </CommonButton>
    </Container>
    <svg style="position:absolute;width:0;height:0">
        <defs>
            <mask id="hole-mask">
                <!-- White = area where overlay is visible (the dimming) -->
                <rect x="0" y="0" width="100vw" height="100vh" fill="white" />
                <!-- Black = hole where overlay is transparent -->
                <rect id="mask-hole" x="100" y="100" width="100" height="100" fill="black" />
            </mask>
        </defs>
    </svg>
    <div class="masked_overlay"></div>
</Container>

<style lang="scss">
    :global(.neuron_gate_menu_trigger.open > .neuron_gate_list_item) {
        background-color: var(--background-1) !important;
        border-color: transparent !important;
        box-shadow: var(--menu-sh);
        opacity: 1 !important;
    }

    :global(.neuron_gate_list:has(.neuron_gate_menu_trigger.open) .masked_overlay) {
        display: block;
        opacity: 1;
    }

    svg {
        position: absolute;
    }

    .masked_overlay {
        transition: opacity 300ms ease-in-out;
        opacity: 0;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 90;

        /* Both mask syntaxes for full browser coverage */
        mask: url(#hole-mask);
        -webkit-mask: url(#hole-mask);
        pointer-events: none;
    }
</style>
