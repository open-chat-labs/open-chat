<script lang="ts">
    import { iconSize, SIGNER_WALLETS, type SignerWallet } from "@client";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Menu from "../Menu.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import MenuItem from "../MenuItem.svelte";
    import Translatable from "../Translatable.svelte";

    const OPENCHAT_LOGO = "/assets/oc_logo_no_bg.svg";

    interface Props {
        // The external wallet the payment will come from, or undefined for the user's own OpenChat
        // account, which is where payments have always come from
        wallet?: SignerWallet;
    }

    let { wallet = $bindable() }: Props = $props();
</script>

<div class="source-wallet">
    <div class="label">
        <Translatable resourceKey={i18nKey("externalWallet.sourceWallet")} />
    </div>
    <MenuIcon centered position={"bottom"} align={"end"}>
        {#snippet menuIcon()}
            <div class="trigger">
                <img
                    class="wallet-logo"
                    alt={wallet?.name ?? "OpenChat"}
                    src={wallet?.logo ?? OPENCHAT_LOGO} />
                <ChevronDown viewBox={"0 0 24 24"} size={$iconSize} color={"var(--icon-txt)"} />
            </div>
        {/snippet}
        {#snippet menuItems()}
            <Menu centered>
                <MenuItem onclick={() => (wallet = undefined)}>
                    {#snippet icon()}
                        <img class="wallet-logo" alt="OpenChat" src={OPENCHAT_LOGO} />
                    {/snippet}
                    {#snippet text()}
                        OpenChat
                    {/snippet}
                </MenuItem>
                {#each SIGNER_WALLETS as w (w.id)}
                    <MenuItem onclick={() => (wallet = w)}>
                        {#snippet icon()}
                            <img class="wallet-logo" alt={w.name} src={w.logo} />
                        {/snippet}
                        {#snippet text()}
                            {w.name}
                        {/snippet}
                    </MenuItem>
                {/each}
            </Menu>
        {/snippet}
    </MenuIcon>
</div>

<style lang="scss">
    .source-wallet {
        display: flex;
        align-items: center;
        gap: $sp2;
    }

    // Matches the "Balance" label alongside, in BalanceWithRefresh
    .label {
        @include font(bold, normal, fs-100, 22);
        color: var(--txt-light);
        font-weight: 400;
        white-space: nowrap;
    }

    .trigger {
        display: flex;
        cursor: pointer;
        align-items: center;
        gap: $sp1;
    }

    .wallet-logo {
        width: $sp5;
        height: $sp5;
        border-radius: 50%;
    }
</style>
