<script lang="ts">
    import MenuIcon from "../../MenuIcon.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import PencilOutline from "svelte-material-icons/PencilOutline.svelte";
    import Pound from "svelte-material-icons/Pound.svelte";
    import LocationExit from "svelte-material-icons/LocationExit.svelte";
    import FileDocument from "svelte-material-icons/FileDocument.svelte";
    import PlaylistPlus from "svelte-material-icons/PlaylistPlus.svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import Kebab from "svelte-material-icons/DotsVertical.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import Menu from "../../Menu.svelte";
    import { _ } from "svelte-i18n";
    import MenuItem from "../../MenuItem.svelte";
    import type { CommunitySummary } from "openchat-client";
    import { createEventDispatcher } from "svelte";
    import { pushRightPanelHistory } from "../../../stores/rightPanel";

    export let community: CommunitySummary;

    const dispatch = createEventDispatcher();

    $: member = community.membership.role !== "none";
    $: canLeave = member && true; //TODO this need to be based on permissions
    $: canDelete = member && true; //TODO this need to be based on permissions
    $: canEdit = member && true; //TODO this need to be based on permissions
    $: canInvite = member && true; //TODO this need to be based on permissions
    $: canCreateChannel = member && true; //TODO this need to be based on permissions

    function leaveCommunity() {
        dispatch("leaveCommunity", {
            kind: "leave_community",
            communityId: community.id,
        });
    }

    function deleteCommunity() {
        dispatch("deleteCommunity", {
            kind: "delete_community",
            communityId: community.id,
            doubleCheck: {
                challenge: $_("typeGroupName", { values: { name: community.name } }),
                response: community.name,
            },
        });
    }

    function communityDetails() {
        dispatch("communityDetails", community);
    }

    function newChannel() {
        canCreateChannel && dispatch("newChannel");
    }

    function showMembers() {
        pushRightPanelHistory({ kind: "show_community_members" });
    }
    function invite() {
        canInvite && pushRightPanelHistory({ kind: "invite_community_users" });
    }
    function showChannels() {
        pushRightPanelHistory({
            kind: "community_channels",
        });
    }

    function editCommunity() {
        canEdit && dispatch("editCommunity", community);
    }
</script>

<MenuIcon position="bottom" align="end">
    <span slot="icon">
        <HoverIcon>
            <Kebab size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
    <span slot="menu">
        <Menu>
            <MenuItem on:click={communityDetails}>
                <FileDocument size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                <div slot="text">{$_("communities.details")}</div>
            </MenuItem>
            <MenuItem on:click={showMembers}>
                <AccountMultiple size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                <div slot="text">{$_("communities.members")}</div>
            </MenuItem>
            {#if canInvite}
                <MenuItem on:click={invite}>
                    <AccountMultiplePlus
                        size={$iconSize}
                        color={"var(--icon-inverted-txt)"}
                        slot="icon" />
                    <div slot="text">{$_("communities.invite")}</div>
                </MenuItem>
            {/if}
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
            {#if canCreateChannel}
                <MenuItem on:click={newChannel}>
                    <PlaylistPlus size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                    <span slot="text">{$_("communities.createChannel")}</span>
                </MenuItem>
            {/if}
            {#if member}
                <MenuItem separator />
                {#if canDelete}
                    <MenuItem warning on:click={deleteCommunity}>
                        <DeleteOutline size={$iconSize} color={"var(--menu-warn)"} slot="icon" />
                        <div slot="text">{$_("communities.delete")}</div>
                    </MenuItem>
                {/if}
                {#if canLeave}
                    <MenuItem warning on:click={leaveCommunity}>
                        <LocationExit size={$iconSize} color={"var(--menu-warn)"} slot="icon" />
                        <div slot="text">{$_("communities.leave")}</div>
                    </MenuItem>
                {/if}
            {/if}
        </Menu>
    </span>
</MenuIcon>
