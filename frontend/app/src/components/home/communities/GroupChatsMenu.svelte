<script lang="ts">
    import MenuIcon from "../../MenuIcon.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import Kebab from "svelte-material-icons/DotsVertical.svelte";
    import Compass from "svelte-material-icons/CompassOutline.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import Menu from "../../Menu.svelte";
    import { _ } from "svelte-i18n";
    import MenuItem from "../../MenuItem.svelte";
    import { createEventDispatcher } from "svelte";
    import page from "page";

    const dispatch = createEventDispatcher();

    function newGroup() {
        dispatch("newGroup");
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
            <MenuItem on:click={newGroup}>
                <AccountMultiplePlus
                    size={$iconSize}
                    color={"var(--icon-inverted-txt)"}
                    slot="icon" />
                <span slot="text">{$_("newGroup")}</span>
            </MenuItem>
            <MenuItem on:click={() => page("/groups")}>
                <Compass size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                <span slot="text">{$_("exploreGroups")}</span>
            </MenuItem>
        </Menu>
    </span>
</MenuIcon>
