<script lang="ts">
    import { ui, type NamedAccount } from "openchat-client";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Menu from "../../Menu.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import Translatable from "../../Translatable.svelte";

    interface Props {
        accounts: NamedAccount[];
        targetAccount: string;
    }

    let { accounts, targetAccount = $bindable() }: Props = $props();

    let selectedName: string | undefined = $state(undefined);
    let menuIconEl: MenuIcon | undefined = $state();

    $effect(() => {
        selectedName = accounts.find((a) => {
            return a.account.toLowerCase() === targetAccount.toLowerCase();
        })?.name;
    });

    function collapseAccount(account: string) {
        if (account.length > 23) {
            return account.slice(0, 10) + "..." + account.slice(account.length - 10);
        }
        return account;
    }

    function selectAccount(namedAccount: NamedAccount) {
        targetAccount = namedAccount.account;
    }

    function showMenu(e: Event) {
        e.stopPropagation();
        menuIconEl?.showMenu();
    }
</script>

<div role="combobox" tabindex="0" class="selected" onclick={showMenu}>
    <div class="name">
        <Translatable resourceKey={i18nKey(selectedName ?? "tokenTransfer.chooseAddress")} />
    </div>
    <div class="icon">
        <MenuIcon bind:this={menuIconEl} position={ui.mobileWidth ? "top" : "bottom"} align={"end"}>
            {#snippet menuIcon()}
                <ChevronDown viewBox={"0 -3 24 24"} size={ui.iconSize} color={"var(--icon-txt)"} />
            {/snippet}
            {#snippet menuItems()}
                <Menu>
                    {#each accounts as namedAccount}
                        <MenuItem unpadded onclick={() => selectAccount(namedAccount)}>
                            {#snippet text()}
                                <div class="named-account">
                                    <div class="name">
                                        {namedAccount.name}
                                    </div>
                                    <div class="account">
                                        {collapseAccount(namedAccount.account)}
                                    </div>
                                </div>
                            {/snippet}
                        </MenuItem>
                    {/each}
                </Menu>
            {/snippet}
        </MenuIcon>
    </div>
</div>

<style lang="scss">
    .selected {
        display: flex;
        align-items: center;
        gap: $sp3;
        cursor: pointer;
        @include font(book, normal, fs-80);

        .name {
            color: var(--primary);
        }

        .icon {
            transition: transform 250ms ease-in-out;
            transform-origin: 50%;
        }
    }

    .named-account {
        padding: $sp3;
        display: flex;
        flex-direction: column;
        @include font(book, normal, fs-80);
        font-family: var(--font);

        .name {
            color: var(--primary);
        }

        .account {
            @include font(light, normal, fs-70);
            color: var(--menu-disabled-txt);
        }
    }
</style>
