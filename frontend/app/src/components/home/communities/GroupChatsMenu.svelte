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
    import { getContext, tick } from "svelte";
    import page from "page";
    import type { OpenChat } from "openchat-client";
    import { identityState, anonUser, publish } from "openchat-client";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        canMarkAllRead: boolean;
    }

    let { canMarkAllRead }: Props = $props();

    function newGroup() {
        if ($anonUser) {
            client.updateIdentityState({
                kind: "logging_in",
                postLogin: { kind: "create_group" },
            });
        } else {
            publish("newGroup");
        }
    }
    $effect(() => {
        if (
            $identityState.kind === "logged_in" &&
            $identityState.postLogin?.kind === "create_group"
        ) {
            client.clearPostLoginState();
            tick().then(() => newGroup());
        }
    });
</script>

<MenuIcon position="bottom" align="end">
    {#snippet menuIcon()}
        <HoverIcon>
            <Kebab size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    {/snippet}
    {#snippet menuItems()}
        <Menu>
            <MenuItem onclick={newGroup}>
                {#snippet icon()}
                    <AccountMultiplePlus size={$iconSize} color={"var(--icon-inverted-txt)"} />
                {/snippet}
                {#snippet text()}
                    <Translatable resourceKey={i18nKey("newGroup")} />
                {/snippet}
            </MenuItem>
            <MenuItem onclick={() => page("/groups")}>
                {#snippet icon()}
                    <Compass size={$iconSize} color={"var(--icon-inverted-txt)"} />
                {/snippet}
                {#snippet text()}
                    <Translatable resourceKey={i18nKey("exploreGroups")} />
                {/snippet}
            </MenuItem>
            <MenuItem
                disabled={!canMarkAllRead}
                onclick={() => client.markAllReadForCurrentScope()}>
                {#snippet icon()}
                    <CheckboxMultipleMarked size={$iconSize} color={"var(--icon-inverted-txt)"} />
                {/snippet}
                {#snippet text()}
                    <Translatable resourceKey={i18nKey("markAllRead")} />
                {/snippet}
            </MenuItem>
        </Menu>
    {/snippet}
</MenuIcon>
