<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import {
        Body,
        BodySmall,
        ColourVars,
        CommonButton,
        Container,
        IconButton,
        Label,
        MenuItem,
        MenuTrigger,
    } from "component-lib";
    import Delete from "svelte-material-icons/DeleteForeverOutline.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import Plus from "svelte-material-icons/Plus.svelte";
    import Pound from "svelte-material-icons/Pound.svelte";
    import Edit from "svelte-material-icons/TextBoxEditOutline.svelte";
    import Translatable from "../../../Translatable.svelte";
    import SlidingPageContent from "../../SlidingPageContent.svelte";
    import { updateCommunityState } from "./community.svelte";
    import EditChannel from "./EditChannel.svelte";

    const MAX_CHANNELS = 15;

    let ucs = updateCommunityState;

    let editingChannelName = $state<string>();
    let originalChannelName = $state<string>();

    function addChannel() {
        editingChannelName = "";
        originalChannelName = undefined;
    }

    function editChannel(name: string) {
        editingChannelName = name;
        originalChannelName = name;
    }

    function cancelEdit() {
        editingChannelName = originalChannelName = undefined;
    }

    function saveChannel() {
        if (editingChannelName !== originalChannelName) {
            ucs.updateChannelName(originalChannelName, editingChannelName);
            cancelEdit();
        }
    }
</script>

{#if editingChannelName !== undefined}
    <EditChannel
        mode={originalChannelName === undefined ? "add" : "edit"}
        onSave={saveChannel}
        bind:channelName={editingChannelName}
        onCancel={cancelEdit}></EditChannel>
{/if}

<SlidingPageContent title={i18nKey("Public channels")}>
    <Container
        supplementalClass={"gate_list"}
        height={{ kind: "fill" }}
        gap={"lg"}
        direction={"vertical"}
        padding={["xl", "lg"]}>
        <Container gap={"xl"} direction={"vertical"}>
            <Container gap={"sm"} direction={"vertical"} padding={["zero", "sm"]}>
                <Body fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Add public channels")}></Translatable>
                </Body>

                <BodySmall colour={"textSecondary"}>
                    <Translatable
                        resourceKey={i18nKey(
                            "Add one or more public channels. They are visible to everyone within the community and new community members will be added automatically.",
                        )}></Translatable>
                </BodySmall>
            </Container>
            <Container gap={"md"} direction={"vertical"}>
                {#each ucs.channelNames as channelName}
                    <MenuTrigger maskUI fill position={"bottom"} align={"end"}>
                        <Container
                            supplementalClass={"channel_list_item"}
                            crossAxisAlignment={"center"}
                            borderColour={ColourVars.background2}
                            borderWidth={"thick"}
                            gap={"md"}
                            padding={"md"}
                            borderRadius={"md"}>
                            <Pound size={"1.5rem"} color={ColourVars.primary} />

                            <Container direction={"vertical"}>
                                <Label ellipsisTruncate fontWeight={"bold"}>{channelName}</Label>
                            </Container>

                            <IconButton size={"md"}>
                                {#snippet icon()}
                                    <DotsVertical color={ColourVars.textSecondary} />
                                {/snippet}
                            </IconButton>
                        </Container>
                        {#snippet menuItems()}
                            <MenuItem onclick={() => editChannel(channelName)}>
                                {#snippet icon(color)}
                                    <Edit {color} />
                                {/snippet}
                                Edit
                            </MenuItem>
                            {#if ucs.channelNames.length > 1}
                                <MenuItem danger onclick={() => ucs.deleteChannelName(channelName)}>
                                    {#snippet icon(color)}
                                        <Delete {color} />
                                    {/snippet}
                                    Remove
                                </MenuItem>
                            {/if}
                        {/snippet}
                    </MenuTrigger>
                {/each}
            </Container>
        </Container>

        <Container mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"center"}>
            <CommonButton
                onClick={() => ucs.resetChannelNames()}
                disabled={ucs.channelNames.length <= 1}
                size={"small_text"}>
                {#snippet icon(color)}
                    <Delete {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Remove all")}></Translatable>
            </CommonButton>
            <CommonButton
                disabled={ucs.channelNames.length >= MAX_CHANNELS}
                onClick={addChannel}
                mode={"active"}
                size={"medium"}>
                {#snippet icon(color)}
                    <Plus {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Add channel")}></Translatable>
            </CommonButton>
        </Container>
    </Container>
</SlidingPageContent>

<style lang="scss">
    :global(.menu_trigger_clone > .channel_list_item) {
        background-color: var(--background-1) !important;
        border-color: transparent !important;
        box-shadow: var(--menu-sh);
        opacity: 1 !important;
    }
</style>
