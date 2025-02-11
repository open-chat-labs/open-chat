<script lang="ts">
    import MenuIcon from "../../MenuIcon.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import CheckboxMultipleMarked from "svelte-material-icons/CheckboxMultipleMarked.svelte";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import Kebab from "svelte-material-icons/DotsVertical.svelte";
    import Compass from "svelte-material-icons/CompassOutline.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import { createEventDispatcher, getContext, tick } from "svelte";
    import page from "page";
    import type { OpenChat } from "openchat-client";
    import { identityState, anonUser } from "openchat-client";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let canMarkAllRead: boolean;

    $: {
        if (
            $identityState.kind === "logged_in" &&
            $identityState.postLogin?.kind === "create_group"
        ) {
            client.clearPostLoginState();
            tick().then(() => newGroup());
        }
    }

    function newGroup() {
        if ($anonUser) {
            client.updateIdentityState({
                kind: "logging_in",
                postLogin: { kind: "create_group" },
            });
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
            <MenuItem onclick={newGroup}>
                <AccountMultiplePlus
                    size={$iconSize}
                    color={"var(--icon-inverted-txt)"}
                    slot="icon" />
                <span slot="text"><Translatable resourceKey={i18nKey("newGroup")} /></span>
            </MenuItem>
            <MenuItem onclick={() => page("/groups")}>
                <Compass size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                <span slot="text"><Translatable resourceKey={i18nKey("exploreGroups")} /></span>
            </MenuItem>
            <MenuItem disabled={!canMarkAllRead} onclick={() => dispatch("markAllRead")}>
                <CheckboxMultipleMarked
                    size={$iconSize}
                    color={"var(--icon-inverted-txt)"}
                    slot="icon" />
                <span slot="text"><Translatable resourceKey={i18nKey("markAllRead")} /></span>
            </MenuItem>
        </Menu>
    </span>
</MenuIcon>
