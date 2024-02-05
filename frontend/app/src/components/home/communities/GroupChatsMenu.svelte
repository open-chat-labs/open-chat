<script lang="ts">
    import MenuIcon from "../../MenuIcon.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import Kebab from "svelte-material-icons/DotsVertical.svelte";
    import Compass from "svelte-material-icons/CompassOutline.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import page from "page";
    import type { OpenChat } from "openchat-client";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    $: anonUser = client.anonUser;

    function newGroup() {
        if ($anonUser) {
            client.identityState.set({ kind: "logging_in" });
        } else {
            dispatch("newGroup");
        }
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
                <span slot="text"><Translatable resourceKey={i18nKey("newGroup")} /></span>
            </MenuItem>
            <MenuItem on:click={() => page("/groups")}>
                <Compass size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                <span slot="text"><Translatable resourceKey={i18nKey("exploreGroups")} /></span>
            </MenuItem>
        </Menu>
    </span>
</MenuIcon>
