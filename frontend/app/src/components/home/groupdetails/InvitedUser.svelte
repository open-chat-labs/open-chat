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
    export let canUninviteUser: boolean = false;
    export let searchTerm: string = "";

    function uninviteUser() {
        dispatch("uninviteUser", user);
    }

    function openUserProfile() {
        dispatch("openUserProfile", user.userId);
    }
</script>

<User {user} {searchTerm} on:open={openUserProfile}>
    {#if canUninviteUser}
        <span class="menu">
            <MenuIcon position={"bottom"} align={"end"}>
                <span slot="icon">
                    <HoverIcon>
                        <ChevronDown size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                </span>
                <span slot="menu">
                    <Menu>
                        <MenuItem on:click={uninviteUser}>
                            <Cancel
                                size={$iconSize}
                                color={"var(--icon-inverted-txt)"}
                                slot="icon" />
                            <div slot="text">{$_("uninviteUser")}</div>
                        </MenuItem>
                    </Menu>
                </span>
            </MenuIcon>
        </span>
    {/if}
</User>
