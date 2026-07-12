<script lang="ts">
    import type { OpenChat } from "@client";
    import { anonUserStore, iconSize, identityStateStore, publish } from "@client";
    import { getContext, tick } from "svelte";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import CheckboxMultipleMarked from "svelte-material-icons/CheckboxMultipleMarked.svelte";
    import Kebab from "svelte-material-icons/DotsVertical.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import HoverIcon from "@src/ui/HoverIcon.svelte";
    import Menu from "@src/desktop/shared/Menu.svelte";
    import MenuIcon from "@src/desktop/shared/MenuIcon.svelte";
    import MenuItem from "@src/desktop/shared/MenuItem.svelte";
    import Translatable from "@src/ui/Translatable.svelte";

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
            $identityStateStore.kind === "logged_in" &&
            $identityStateStore.postLogin?.kind === "create_group"
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
