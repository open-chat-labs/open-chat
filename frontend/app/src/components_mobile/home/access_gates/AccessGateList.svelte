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
    import type { LeafGate, OpenChat } from "openchat-client";
    import { getContext, type Snippet } from "svelte";
    import Delete from "svelte-material-icons/DeleteForeverOutline.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import Plus from "svelte-material-icons/Plus.svelte";
    import Edit from "svelte-material-icons/TextBoxEditOutline.svelte";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import type { UpdateGroupOrCommunityState } from "../groupOrCommunity.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        data: UpdateGroupOrCommunityState;
        pageTitleKey: string;
        titleKey: string;
        descKey: string;
        gates: LeafGate[];
        fallbackIcon: string;
        gateSubtext: (gate: LeafGate) => string | undefined;
        onEdit: (gate: LeafGate) => void;
        gateTypeSummary: Snippet;
        onRemoveAll: () => void;
        onAddGate: () => void;
    }

    let {
        data,
        pageTitleKey,
        gates,
        fallbackIcon,
        gateSubtext,
        onEdit,
        titleKey,
        descKey,
        gateTypeSummary,
        onRemoveAll,
        onAddGate,
    }: Props = $props();
</script>

<SlidingPageContent title={i18nKey(pageTitleKey)}>
    <Container
        supplementalClass={"gate_list"}
        height={{ kind: "fill" }}
        gap={"lg"}
        direction={"vertical"}
        padding={["xl", "lg"]}>
        {@render gateTypeSummary()}

        {#if gates.length > 0}
            <Container gap={"xl"} direction={"vertical"}>
                <Container gap={"sm"} direction={"vertical"} padding={["zero", "sm"]}>
                    <Body fontWeight={"bold"}>
                        <Translatable resourceKey={i18nKey(titleKey)}></Translatable>
                    </Body>

                    <BodySmall colour={"textSecondary"}>
                        <Translatable resourceKey={i18nKey(descKey)}></Translatable>
                    </BodySmall>
                </Container>
                <Container gap={"md"} direction={"vertical"}>
                    {#each gates as gate}
                        {@const token = client.getTokenDetailsForAccessGate(gate)}
                        <MenuTrigger maskUI fill position={"bottom"} align={"end"}>
                            <Container
                                supplementalClass={"gate_list_item"}
                                crossAxisAlignment={"center"}
                                borderColour={ColourVars.background2}
                                borderWidth={"thick"}
                                gap={"md"}
                                padding={"md"}
                                borderRadius={"md"}>
                                <Avatar
                                    size={"sm"}
                                    url={token?.logo ?? `/assets/access_gate/${fallbackIcon}`} />

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
                                <MenuItem onclick={() => onEdit(gate)}>
                                    {#snippet icon(color)}
                                        <Edit {color} />
                                    {/snippet}
                                    Edit
                                </MenuItem>
                                <MenuItem danger onclick={() => data.deleteGate(gate)}>
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
            <CommonButton onClick={onRemoveAll} disabled={gates.length === 0} size={"small_text"}>
                {#snippet icon(color)}
                    <Delete {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Remove all")}></Translatable>
            </CommonButton>
            <CommonButton onClick={onAddGate} mode={"active"} size={"medium"}>
                {#snippet icon(color)}
                    <Plus {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Add gate")}></Translatable>
            </CommonButton>
        </Container>
    </Container>
</SlidingPageContent>

<style lang="scss">
    :global(.menu_trigger_clone > .gate_list_item) {
        background-color: var(--background-1) !important;
        border-color: transparent !important;
        box-shadow: var(--menu-sh);
        opacity: 1 !important;
    }
</style>
