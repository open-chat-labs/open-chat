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
    import { OpenChat, publish, type NeuronGate } from "openchat-client";
    import { getContext } from "svelte";
    import Delete from "svelte-material-icons/DeleteForeverOutline.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import Plus from "svelte-material-icons/Plus.svelte";
    import Edit from "svelte-material-icons/TextBoxEditOutline.svelte";
    import Translatable from "../../../Translatable.svelte";
    import SlidingPageContent from "../../SlidingPageContent.svelte";
    import { updateGroupState } from "../group.svelte";
    import AboutNeuronGate from "./AboutNeuronGate.svelte";

    const client = getContext<OpenChat>("client");

    let ugs = updateGroupState;

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
        ugs.neuronGates.forEach((g) => ugs.deleteGate(g));
    }
</script>

<SlidingPageContent title={i18nKey("Neuron access gates")}>
    <Container
        supplementalClass={"neuron_gate_list"}
        height={{ kind: "fill" }}
        gap={"lg"}
        direction={"vertical"}
        padding={["xl", "lg"]}>
        <AboutNeuronGate padding={"lg"} background={ColourVars.background1} />

        {#if ugs.neuronGates.length > 0}
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
                    {#each ugs.neuronGates as gate}
                        {@const token = client.getTokenDetailsForAccessGate(gate)}
                        <MenuTrigger maskUI fill position={"bottom"} align={"end"}>
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
                                <MenuItem
                                    onclick={() => publish("updateGroupEditNeuronGate", gate)}>
                                    {#snippet icon(color)}
                                        <Edit {color} />
                                    {/snippet}
                                    Edit
                                </MenuItem>
                                <MenuItem danger onclick={() => ugs.deleteGate(gate)}>
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
            <CommonButton
                onClick={removeAll}
                disabled={ugs.neuronGates.length === 0}
                size={"small_text"}>
                {#snippet icon(color)}
                    <Delete {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Remove all")}></Translatable>
            </CommonButton>
            <CommonButton
                onClick={() => publish("updateGroupEditNeuronGate", ugs.defaultNeuronGate())}
                mode={"active"}
                size={"medium"}>
                {#snippet icon(color)}
                    <Plus {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Add gate")}></Translatable>
            </CommonButton>
        </Container>
    </Container>
</SlidingPageContent>

<style lang="scss">
    :global(.menu_trigger_clone > .neuron_gate_list_item) {
        background-color: var(--background-1) !important;
        border-color: transparent !important;
        box-shadow: var(--menu-sh);
        opacity: 1 !important;
    }
</style>
