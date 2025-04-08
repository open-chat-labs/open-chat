<script lang="ts">
    import SectionHeader from "../../../SectionHeader.svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import Hamburger from "svelte-material-icons/Menu.svelte";
    import PencilOutline from "svelte-material-icons/PencilOutline.svelte";
    import HoverIcon from "../../../HoverIcon.svelte";
    import MenuIcon from "../../../MenuIcon.svelte";
    import Menu from "../../../Menu.svelte";
    import MenuItem from "../../../MenuItem.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { _ } from "svelte-i18n";
    import { iconSize } from "../../../../stores/iconSize";
    import { publish, type CommunitySummary, type Level } from "openchat-client";
    import { rightPanelHistory } from "../../../../stores/rightPanel";
    import { i18nKey } from "../../../../i18n/i18n";
    import Translatable from "../../../Translatable.svelte";

    interface Props {
        community: CommunitySummary;
        canEdit: boolean;
        level: Level;
    }

    let { community, canEdit, level }: Props = $props();

    function close() {
        rightPanelHistory.pop();
    }
    function showMembers() {
        rightPanelHistory.push({ kind: "show_community_members" });
    }
    function invite() {
        rightPanelHistory.push({ kind: "invite_community_users" });
    }
    function editCommunity() {
        if (canEdit) {
            publish("editCommunity", community);
        }
    }
</script>

<SectionHeader border flush shadow>
    <MenuIcon position="bottom" align="start">
        {#snippet menuIcon()}
            <HoverIcon>
                <Hamburger size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        {/snippet}
        {#snippet menuItems()}
            <Menu>
                <MenuItem onclick={showMembers}>
                    {#snippet icon()}
                        <AccountMultiple size={$iconSize} color={"var(--icon-inverted-txt)"} />
                    {/snippet}
                    {#snippet text()}
                        <div>
                            <Translatable resourceKey={i18nKey("communities.members")} />
                        </div>
                    {/snippet}
                </MenuItem>
                <MenuItem onclick={invite}>
                    {#snippet icon()}
                        <AccountMultiplePlus size={$iconSize} color={"var(--icon-inverted-txt)"} />
                    {/snippet}
                    {#snippet text()}
                        <div>
                            <Translatable resourceKey={i18nKey("communities.invite")} />
                        </div>
                    {/snippet}
                </MenuItem>
                {#if canEdit}
                    <MenuItem onclick={editCommunity}>
                        {#snippet icon()}
                            <PencilOutline size={$iconSize} color={"var(--icon-inverted-txt)"} />
                        {/snippet}
                        {#snippet text()}
                            <div>
                                <Translatable resourceKey={i18nKey("communities.edit")} />
                            </div>
                        {/snippet}
                    </MenuItem>
                {/if}
            </Menu>
        {/snippet}
    </MenuIcon>
    <h4><Translatable resourceKey={i18nKey("groupDetails", undefined, level)} /></h4>
    <span title={$_("close")} class="close" onclick={close}>
        <HoverIcon>
            <Close size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
</SectionHeader>

<style lang="scss">
    h4 {
        flex: 1;
        margin: 0;
        text-align: center;
        @include font-size(fs-120);
    }
    .close {
        flex: 0 0 30px;
    }
</style>
