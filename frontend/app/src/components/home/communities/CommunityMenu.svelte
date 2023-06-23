<script lang="ts">
    import MenuIcon from "../../MenuIcon.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
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

    export let community: CommunitySummary;

    const dispatch = createEventDispatcher();

    let canLeave = true; //TODO this need to be based on permissions
    let canDelete = true; //TODO this need to be based on permissions

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
        dispatch("newChannel");
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
            <MenuItem on:click={newChannel}>
                <PlaylistPlus size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                <span slot="text">{$_("communities.createChannel")}</span>
            </MenuItem>
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
        </Menu>
    </span>
</MenuIcon>
