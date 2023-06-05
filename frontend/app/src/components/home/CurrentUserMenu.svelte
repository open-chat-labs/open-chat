<script lang="ts">
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import Home from "svelte-material-icons/Home.svelte";
    import Cogs from "svelte-material-icons/Cogs.svelte";
    import Wallet from "svelte-material-icons/WalletOutline.svelte";
    import Logout from "svelte-material-icons/Logout.svelte";
    import HelpCircleOutline from "svelte-material-icons/HelpCircleOutline.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext } from "svelte";
    import { iconSize } from "../../stores/iconSize";
    import type { OpenChat } from "openchat-client";
    import page from "page";
    import { communitiesEnabled } from "../../utils/features";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    $: canExtendDiamond = client.canExtendDiamond;

    function newGroup() {
        dispatch("newGroup");
    }
</script>

<Menu>
    {#if !$communitiesEnabled}
        <MenuItem on:click={() => dispatch("showHomePage")}>
            <Home size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
            <span slot="text">{$_("homepage")}</span>
        </MenuItem>
    {/if}
    {#if !client.isReadOnly()}
        <MenuItem on:click={newGroup}>
            <AccountMultiplePlus size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
            <span slot="text">{$_("newGroup")}</span>
        </MenuItem>
    {/if}
    <MenuItem on:click={() => page("/hotgroups")}>
        <span class="flame" slot="icon">🔥</span>
        <span slot="text">{$_("whatsHot")}</span>
    </MenuItem>
    <MenuItem on:click={() => dispatch("halloffame")}>
        <span class="halloffame" slot="icon">👑</span>
        <span slot="text">{$_("halloffame.menu")}</span>
    </MenuItem>
    <MenuItem on:click={() => dispatch("upgrade")}>
        <span class="diamond-icon" slot="icon">💎</span>
        <span slot="text">{$canExtendDiamond ? $_("upgrade.extend") : $_("upgrade.diamond")}</span>
    </MenuItem>
    <MenuItem on:click={() => dispatch("profile")}>
        <Cogs size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <span slot="text">{$_("profile.title")}</span>
    </MenuItem>
    <MenuItem on:click={() => dispatch("wallet")}>
        <Wallet size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <span slot="text">{$_("wallet")}</span>
    </MenuItem>
    {#if !$communitiesEnabled}
        <MenuItem on:click={() => page("/faq")}>
            <HelpCircleOutline size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
            <span slot="text">{$_("faq.menu")}</span>
        </MenuItem>
    {/if}
    <MenuItem separator />
    <MenuItem on:click={() => dispatch("logout")}>
        <Logout size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <span slot="text">{$_("logout")}</span>
    </MenuItem>
</Menu>

<style lang="scss">
    .flame,
    .halloffame,
    .diamond-icon {
        @include font(bold, normal, fs-110);
    }
</style>
