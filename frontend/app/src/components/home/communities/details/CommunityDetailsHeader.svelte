<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import SectionHeader from "../../../SectionHeader.svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import Hamburger from "svelte-material-icons/Menu.svelte";
    import PencilOutline from "svelte-material-icons/PencilOutline.svelte";
    import Pound from "svelte-material-icons/Pound.svelte";
    import HoverIcon from "../../../HoverIcon.svelte";
    import MenuIcon from "../../../MenuIcon.svelte";
    import Menu from "../../../Menu.svelte";
    import MenuItem from "../../../MenuItem.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { _ } from "svelte-i18n";
    import { iconSize } from "../../../../stores/iconSize";
    import type { Community, Level } from "openchat-client";
    import { interpolateLevel } from "../../../../utils/i18n";
    import { popRightPanelHistory, pushRightPanelHistory } from "../../../../stores/rightPanel";

    export let community: Community;
    export let canEdit: boolean;
    export let level: Level;

    const dispatch = createEventDispatcher();
    function close() {
        popRightPanelHistory();
    }
    function showMembers() {
        pushRightPanelHistory({ kind: "show_community_members", communityId: community.id });
    }
    function invite() {
        dispatch("invite");
    }
    function showChannels() {
        dispatch("showChannels");
    }
    function editCommunity() {
        if (canEdit) {
            dispatch("editCommunity", community);
        }
    }
</script>

<SectionHeader border flush shadow>
    <MenuIcon position="bottom" align="start">
        <span slot="icon">
            <HoverIcon>
                <Hamburger size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        </span>
        <span slot="menu">
            <Menu>
                <MenuItem on:click={showMembers}>
                    <AccountMultiple
                        size={$iconSize}
                        color={"var(--icon-inverted-txt)"}
                        slot="icon" />
                    <div slot="text">{$_("communities.members")}</div>
                </MenuItem>
                <MenuItem on:click={invite}>
                    <AccountMultiplePlus
                        size={$iconSize}
                        color={"var(--icon-inverted-txt)"}
                        slot="icon" />
                    <div slot="text">{$_("communities.invite")}</div>
                </MenuItem>
                <MenuItem on:click={showChannels}>
                    <Pound size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                    <span slot="text">{$_("communities.channels")}</span>
                </MenuItem>
                {#if canEdit}
                    <MenuItem on:click={editCommunity}>
                        <PencilOutline
                            size={$iconSize}
                            color={"var(--icon-inverted-txt)"}
                            slot="icon" />
                        <div slot="text">{$_("communities.edit")}</div>
                    </MenuItem>
                {/if}
            </Menu>
        </span>
    </MenuIcon>
    <h4>{interpolateLevel("groupDetails", level)}</h4>
    <span title={$_("close")} class="close" on:click={close}>
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
