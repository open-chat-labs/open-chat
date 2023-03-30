<script lang="ts">
    import Hamburger from "svelte-material-icons/Menu.svelte";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import Home from "svelte-material-icons/Home.svelte";
    import Avatar from "../Avatar.svelte";
    import Cogs from "svelte-material-icons/Cogs.svelte";
    import Wallet from "svelte-material-icons/Wallet.svelte";
    import Logout from "svelte-material-icons/Logout.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import HelpCircleOutline from "svelte-material-icons/HelpCircleOutline.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext } from "svelte";
    import { rtlStore } from "../../stores/rtl";
    import { iconSize } from "../../stores/iconSize";
    import { AvatarSize, OpenChat, PartialUserSummary } from "openchat-client";
    import SectionHeader from "../SectionHeader.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let user: PartialUserSummary;

    $: canExtendDiamond = client.canExtendDiamond;
    $: eligibleForAirdrop = client.eligibleForInitialAirdrop;

    function newGroup() {
        dispatch("newGroup");
    }
</script>

<SectionHeader border={false}>
    <div class="current-user" class:rtl={$rtlStore} on:click={() => dispatch("profile")}>
        <div class="avatar">
            <Avatar
                url={client.userAvatarUrl(user)}
                userId={user.userId}
                size={AvatarSize.Default} />
        </div>
        <h4 class:diamond={user.diamond} class="name">{user.username}</h4>
    </div>
    <span class="menu">
        <MenuIcon>
            <span slot="icon">
                <HoverIcon>
                    <Hamburger size={$iconSize} color={"var(--icon-txt)"} />
                </HoverIcon>
            </span>
            <span slot="menu">
                <Menu>
                    <MenuItem on:click={() => dispatch("showHomePage")}>
                        <Home size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                        <span slot="text">{$_("homepage")}</span>
                    </MenuItem>
                    {#if !client.isReadOnly()}
                        <MenuItem on:click={newGroup}>
                            <AccountMultiplePlus
                                size={$iconSize}
                                color={"var(--icon-inverted-txt)"}
                                slot="icon" />
                            <span slot="text">{$_("newGroup")}</span>
                        </MenuItem>
                    {/if}
                    <MenuItem on:click={() => dispatch("whatsHot")}>
                        <span class="flame" slot="icon">🔥</span>
                        <span slot="text">{$_("whatsHot")}</span>
                    </MenuItem>
                    <MenuItem on:click={() => dispatch("upgrade")}>
                        <span class="diamond-icon" slot="icon">💎</span>
                        <span slot="text"
                            >{$canExtendDiamond
                                ? $_("upgrade.extend")
                                : $_("upgrade.diamond")}</span>
                    </MenuItem>
                    {#if $eligibleForAirdrop}
                        <MenuItem on:click={() => dispatch("registerForAirdrop")}>
                            <span class="airdrop" slot="icon">🪂</span>
                            <span slot="text">{$_("airdrop.register")}</span>
                        </MenuItem>
                    {/if}
                    <MenuItem on:click={() => dispatch("profile")}>
                        <Cogs size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                        <span slot="text">{$_("profile.title")}</span>
                    </MenuItem>
                    <MenuItem on:click={() => dispatch("wallet")}>
                        <Wallet size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                        <span slot="text">{$_("wallet")}</span>
                    </MenuItem>
                    <MenuItem on:click={() => dispatch("showFaq")}>
                        <HelpCircleOutline
                            size={$iconSize}
                            color={"var(--icon-inverted-txt)"}
                            slot="icon" />
                        <span slot="text">{$_("faq.menu")}</span>
                    </MenuItem>
                    <MenuItem on:click={() => dispatch("logout")}>
                        <Logout size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                        <span slot="text">{$_("logout")}</span>
                    </MenuItem>
                </Menu>
            </span>
        </MenuIcon>
    </span>
</SectionHeader>

<style type="text/scss">
    :global(.current-user .photo-section) {
        flex: 0 0 45px;
        margin-right: $sp4;
    }

    :global(.current-user.rtl .photo-section) {
        margin-left: $sp4;
        margin-right: 0;
    }

    .flame,
    .airdrop,
    .diamond-icon {
        @include font(bold, normal, fs-110);
    }

    .current-user {
        display: flex;
        flex: 1;
        align-items: center;
        gap: $sp4;
        cursor: pointer;

        @include mobile() {
            padding: 0 $sp3;
        }
    }

    .menu {
        cursor: pointer;
    }

    .diamond {
        @include diamond();
    }
</style>
