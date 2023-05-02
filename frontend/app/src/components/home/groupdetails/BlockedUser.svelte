<svelte:options immutable={true} />

<script lang="ts">
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    import { iconSize } from "../../../stores/iconSize";
    import type { PartialUserSummary } from "openchat-shared";
    import User from "./User.svelte";

    const dispatch = createEventDispatcher();

    export let user: PartialUserSummary;
    export let canUnblockUser: boolean = false;
    export let searchTerm: string = "";

    function unblockUser() {
        dispatch("unblockUser", user);
    }

    function openUserProfile() {
        dispatch("openUserProfile", user.userId);
    }
</script>

<User 
    {user}
    {searchTerm} 
    on:open={openUserProfile}>
    {#if canUnblockUser}
        <span class="menu">
            <MenuIcon>
                <span slot="icon">
                    <HoverIcon>
                        <ChevronDown size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                </span>
                <span slot="menu">
                    <Menu>
                        <MenuItem on:click={unblockUser}>
                            <Cancel
                                size={$iconSize}
                                color={"var(--icon-inverted-txt)"}
                                slot="icon" />
                            <div slot="text">{$_("unblockUser")}</div>
                        </MenuItem>
                    </Menu>
                </span>
            </MenuIcon>
        </span>
    {/if}
</User>
