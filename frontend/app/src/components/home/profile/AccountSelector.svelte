<script lang="ts">
    import type { NamedAccount } from "openchat-client";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import MenuIcon from "../../MenuIconLegacy.svelte";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItemLegacy.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    export let accounts: NamedAccount[];
    export let targetAccount: string;

    let selectedName: string | undefined = undefined;
    let menuIcon: MenuIcon;

    $: {
        selectedName = accounts.find((a) => {
            return a.account.toLowerCase() === targetAccount.toLowerCase();
        })?.name;
    }

    function collapseAccount(account: string) {
        if (account.length > 23) {
            return account.slice(0, 10) + "..." + account.slice(account.length - 10);
        }
        return account;
    }

    function selectAccount(namedAccount: NamedAccount) {
        targetAccount = namedAccount.account;
    }

    function showMenu() {
        menuIcon.showMenu();
    }
</script>

<div role="combobox" tabindex="0" class="selected" on:click|stopPropagation={showMenu}>
    <div class="name">
        <Translatable resourceKey={i18nKey(selectedName ?? "tokenTransfer.chooseAddress")} />
    </div>
    <div class="icon">
        <MenuIcon bind:this={menuIcon} position={$mobileWidth ? "top" : "bottom"} align={"end"}>
            <div slot="icon">
                <ChevronDown viewBox={"0 -3 24 24"} size={$iconSize} color={"var(--icon-txt)"} />
            </div>
            <div slot="menu">
                <Menu>
                    {#each accounts as namedAccount}
                        <MenuItem unpadded onclick={() => selectAccount(namedAccount)}>
                            <div slot="text" class="named-account">
                                <div class="name">
                                    {namedAccount.name}
                                </div>
                                <div class="account">
                                    {collapseAccount(namedAccount.account)}
                                </div>
                            </div>
                        </MenuItem>
                    {/each}
                </Menu>
            </div>
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
