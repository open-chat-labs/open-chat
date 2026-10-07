<script lang="ts">
    import {
        cryptoLookup,
        EXTERNAL_WALLETS_ENABLED,
        iconSize,
        SIGNER_WALLETS,
        type SignerWallet,
    } from "@client";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Menu from "../Menu.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import MenuItem from "../MenuItem.svelte";
    import Translatable from "@shared_components/Translatable.svelte";

    const OPENCHAT_LOGO = "/assets/oc_logo_no_bg.svg";

    interface Props {
        // The external wallet the payment will come from, or undefined for the user's own OpenChat
        // account, which is where payments have always come from
        wallet?: SignerWallet;
        // The ledger of the token being paid
        ledger: string;
    }

    let { wallet = $bindable(), ledger }: Props = $props();

    // A payment is only pulled from an external wallet once it has approved the spender, which
    // needs the token's ledger to support ICRC-2
    let available = $derived(
        EXTERNAL_WALLETS_ENABLED &&
            ($cryptoLookup.get(ledger)?.supportedStandards.includes("ICRC-2") ?? false),
    );

    // Switching to a token which can't be paid from an external wallet goes back to OpenChat's own
    $effect(() => {
        if (!available && wallet !== undefined) {
            wallet = undefined;
        }
    });
</script>

{#if available}
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
{/if}

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
