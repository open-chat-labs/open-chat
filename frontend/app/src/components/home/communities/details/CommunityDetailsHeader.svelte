<script lang="ts">
    import SectionHeader from "../../../SectionHeader.svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import Hamburger from "svelte-material-icons/Menu.svelte";
    import PencilOutline from "svelte-material-icons/PencilOutline.svelte";
    import HoverIcon from "../../../HoverIcon.svelte";
    import MenuIcon from "../../../MenuIconLegacy.svelte";
    import Menu from "../../../Menu.svelte";
    import MenuItem from "../../../MenuItemLegacy.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { _ } from "svelte-i18n";
    import { iconSize } from "../../../../stores/iconSize";
    import type { CommunitySummary, Level } from "openchat-client";
    import { popRightPanelHistory, pushRightPanelHistory } from "../../../../stores/rightPanel";
    import { i18nKey } from "../../../../i18n/i18n";
    import Translatable from "../../../Translatable.svelte";
    import { publish } from "@src/utils/pubsub";

    export let community: CommunitySummary;
    export let canEdit: boolean;
    export let level: Level;

    function close() {
        popRightPanelHistory();
    }
    function showMembers() {
        pushRightPanelHistory({ kind: "show_community_members" });
    }
    function invite() {
        pushRightPanelHistory({ kind: "invite_community_users" });
    }
    function editCommunity() {
        if (canEdit) {
            publish("editCommunity", community);
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
                <MenuItem onclick={showMembers}>
                    <AccountMultiple
                        size={$iconSize}
                        color={"var(--icon-inverted-txt)"}
                        slot="icon" />
                    <div slot="text">
                        <Translatable resourceKey={i18nKey("communities.members")} />
                    </div>
                </MenuItem>
                <MenuItem onclick={invite}>
                    <AccountMultiplePlus
                        size={$iconSize}
                        color={"var(--icon-inverted-txt)"}
                        slot="icon" />
                    <div slot="text">
                        <Translatable resourceKey={i18nKey("communities.invite")} />
                    </div>
                </MenuItem>
                {#if canEdit}
                    <MenuItem onclick={editCommunity}>
                        <PencilOutline
                            size={$iconSize}
                            color={"var(--icon-inverted-txt)"}
                            slot="icon" />
                        <div slot="text">
                            <Translatable resourceKey={i18nKey("communities.edit")} />
                        </div>
                    </MenuItem>
                {/if}
            </Menu>
        </span>
    </MenuIcon>
    <h4><Translatable resourceKey={i18nKey("groupDetails", undefined, level)} /></h4>
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
