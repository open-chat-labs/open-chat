<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { anonUserStore, app, iconSize, publish } from "openchat-client";
    import page from "page";
    import { getContext, tick } from "svelte";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import CheckboxMultipleMarked from "svelte-material-icons/CheckboxMultipleMarked.svelte";
    import Compass from "svelte-material-icons/CompassOutline.svelte";
    import Kebab from "svelte-material-icons/DotsVertical.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import HoverIcon from "../../HoverIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        canMarkAllRead: boolean;
    }

    let { canMarkAllRead }: Props = $props();

    function newGroup() {
        if ($anonUserStore) {
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
            app.identityState.kind === "logged_in" &&
            app.identityState.postLogin?.kind === "create_group"
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
