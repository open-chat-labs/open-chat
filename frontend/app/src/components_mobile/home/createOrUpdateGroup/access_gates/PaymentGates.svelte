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
    import { OpenChat, publish, type PaymentGate } from "openchat-client";
    import { getContext } from "svelte";
    import Delete from "svelte-material-icons/DeleteForeverOutline.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import Plus from "svelte-material-icons/Plus.svelte";
    import Edit from "svelte-material-icons/TextBoxEditOutline.svelte";
    import Translatable from "../../../Translatable.svelte";
    import SlidingPageContent from "../../SlidingPageContent.svelte";
    import { updateGroupState } from "../group.svelte";
    import AboutPaymentGate from "./AboutPaymentGate.svelte";

    const client = getContext<OpenChat>("client");

    let ugs = updateGroupState;

    function gateSubtext(gate: PaymentGate): string | undefined {
        const token = client.getTokenDetailsForAccessGate(gate);
        const amount = client.formatTokens(gate.amount, token?.decimals ?? 2);
        return `${amount} tokens`;
    }

    function removeAll() {
        ugs.paymentGates.forEach((g) => ugs.deleteGate(g));
    }
</script>

<SlidingPageContent title={i18nKey("Payment access gates")}>
    <Container
        supplementalClass={"payment_gate_list"}
        height={{ kind: "fill" }}
        gap={"lg"}
        direction={"vertical"}
        padding={["xl", "lg"]}>
        <AboutPaymentGate padding={"lg"} background={ColourVars.background1} />

        {#if ugs.paymentGates.length > 0}
            <Container gap={"xl"} direction={"vertical"}>
                <Container gap={"sm"} direction={"vertical"} padding={["zero", "sm"]}>
                    <Body fontWeight={"bold"}>
                        <Translatable resourceKey={i18nKey("Existing payment gates")}
                        ></Translatable>
                    </Body>

                    <BodySmall colour={"textSecondary"}>
                        <Translatable
                            resourceKey={i18nKey(
                                "You may add multiple payment gates for your group. Tap on any to access the edit / remove actions.",
                            )}></Translatable>
                    </BodySmall>
                </Container>
                <Container gap={"md"} direction={"vertical"}>
                    {#each ugs.paymentGates as gate}
                        {@const token = client.getTokenDetailsForAccessGate(gate)}
                        <MenuTrigger maskUI fill position={"bottom"} align={"end"}>
                            <Container
                                supplementalClass={"payment_gate_list_item"}
                                crossAxisAlignment={"center"}
                                borderColour={ColourVars.background2}
                                borderWidth={"thick"}
                                gap={"md"}
                                padding={"md"}
                                borderRadius={"md"}>
                                <Avatar
                                    size={"sm"}
                                    url={token?.logo ?? "/assets/access_gate/payment.svg"} />

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
                                    onclick={() => publish("updateGroupEditPaymentGate", gate)}>
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
                disabled={ugs.paymentGates.length === 0}
                size={"small_text"}>
                {#snippet icon(color)}
                    <Delete {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Remove all")}></Translatable>
            </CommonButton>
            <CommonButton
                onClick={() => publish("updateGroupEditPaymentGate", ugs.defaultPaymentGate())}
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
    :global(.menu_trigger_clone > .payment_gate_list_item) {
        background-color: var(--background-1) !important;
        border-color: transparent !important;
        box-shadow: var(--menu-sh);
        opacity: 1 !important;
    }
</style>
