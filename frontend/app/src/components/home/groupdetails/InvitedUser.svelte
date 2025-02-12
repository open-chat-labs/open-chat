<svelte:options immutable />

<script lang="ts">
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import MenuIcon from "../../MenuIconLegacy.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItemLegacy.svelte";
    import { createEventDispatcher } from "svelte";
    import { iconSize } from "../../../stores/iconSize";
    import type { UserSummary } from "openchat-shared";
    import User from "./User.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    const dispatch = createEventDispatcher();

    export let user: UserSummary;
    export let canUninviteUser: boolean = false;
    export let searchTerm: string = "";
    export let me = false;

    function cancelInvite() {
        dispatch("cancelInvite", user.userId);
    }
</script>

<User {me} {user} {searchTerm}>
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
                        <MenuItem onclick={cancelInvite}>
                            <Cancel
                                size={$iconSize}
                                color={"var(--icon-inverted-txt)"}
                                slot="icon" />
                            <div slot="text">
                                <Translatable resourceKey={i18nKey("cancelInvite")} />
                            </div>
                        </MenuItem>
                    </Menu>
                </span>
            </MenuIcon>
        </span>
    {/if}
</User>
