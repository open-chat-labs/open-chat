<script lang="ts">
    import MenuIcon from "../../MenuIcon.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import LocationExit from "svelte-material-icons/LocationExit.svelte";
    import Kebab from "svelte-material-icons/DotsVertical.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import Menu from "../../Menu.svelte";
    import { _ } from "svelte-i18n";
    import MenuItem from "../../MenuItem.svelte";
    import type { Community } from "openchat-client";
    import AreYouSure from "../../AreYouSure.svelte";

    export let community: Community;

    let confirm = false;

    function leaveCommunity() {
        confirm = true;
    }

    function doLeaveCommunity(_leave: boolean) {
        console.log("TODO - leave community", community);
        confirm = false;
        return Promise.resolve();
    }
</script>

{#if confirm}
    <AreYouSure
        message={$_("communities.leaveMessage")}
        title={$_("areYouSure")}
        action={doLeaveCommunity} />
{/if}

<MenuIcon position="bottom" align="end">
    <span slot="icon">
        <HoverIcon>
            <Kebab size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
    <span slot="menu">
        <Menu>
            <MenuItem warning on:click={leaveCommunity}>
                <LocationExit size={$iconSize} color={"var(--menu-warn)"} slot="icon" />
                <div slot="text">{$_("communities.leave")}</div>
            </MenuItem>
        </Menu>
    </span>
</MenuIcon>

<style type="text/scss">
</style>
