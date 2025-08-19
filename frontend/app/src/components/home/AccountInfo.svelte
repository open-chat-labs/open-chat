<script lang="ts">
    import {
        bitcoinAddress,
        BTC_SYMBOL,
        CKBTC_SYMBOL,
        cryptoLookup,
        currentUserIdStore,
        currentUserStore,
        ICP_SYMBOL,
        Lazy,
        OpenChat,
    } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import QRCode from "../QRCode.svelte";
    import Translatable from "../Translatable.svelte";
    import TruncatedAccount from "./TruncatedAccount.svelte";
    import NetworkSelector from "./NetworkSelector.svelte";

    interface Props {
        qrSize?: "default" | "smaller" | "larger";
        ledger: string;
        centered?: boolean;
        border?: boolean;
        fullWidthOnMobile?: boolean;
    }

    let {
        qrSize = "default",
        ledger,
        centered = false,
        border = true,
        fullWidthOnMobile = false,
    }: Props = $props();

    const client = getContext<OpenChat>("client");

    let tokenDetails = $derived($cryptoLookup.get(ledger)!);
    let selectedNetwork = $state<string | undefined>(undefined);
    let networks = $derived.by(() => {
        if (tokenDetails.symbol === BTC_SYMBOL) {
            return [BTC_SYMBOL, CKBTC_SYMBOL];
        } else {
            return [];
        }
    });
    $effect(() => {
        selectedNetwork = networks[0];
    });

    let account = $derived.by(() => {
        if (tokenDetails.symbol === ICP_SYMBOL) {
            return $currentUserStore.cryptoAccount;
        } else if (tokenDetails.symbol === BTC_SYMBOL && selectedNetwork === BTC_SYMBOL) {
            return $bitcoinAddress;
        } else {
            return $currentUserIdStore;
        }
    });

    // Internally, this will fetch the BTC address then update the `btcAddress` store
    const btcAddressPromise = new Lazy(() => client.getBtcAddress());

    let error = $state();
    $effect(() => {
        if (account === undefined) {
            if (selectedNetwork === BTC_SYMBOL) {
                btcAddressPromise.get().catch((e) => error = e);
            }
        }
    });

    let networkName = $derived(selectedNetwork ?? tokenDetails.symbol);
    let logo = $derived.by(() => {
        switch (selectedNetwork) {
            case BTC_SYMBOL:
                return "/assets/btc_logo.svg";
            case CKBTC_SYMBOL:
                return "/assets/ckbtc_nobackground.svg";
            default:
                return tokenDetails.logo;
        }
    });

    const btcDepositFeePromise = new Lazy(() => client.getCkbtcMinterDepositInfo()
        .then((depositInfo) => `${client.formatTokens(depositInfo.depositFee, 8)} BTC`));
</script>

<div class="account-info">
    {#if networks.length > 0 && selectedNetwork !== undefined}
        <NetworkSelector {networks} bind:selectedNetwork={selectedNetwork} />
    {/if}

    {#if account === undefined}
        <div class="generating">
            {#if error !== undefined}
                <div class="error-icon"></div>
            {:else}
                <div class="spinner"></div>
            {/if}
        </div>
    {:else}
        <QRCode {fullWidthOnMobile} text={account} size={qrSize} {logo} {border} />
    {/if}
    <p class="your-account" class:centered>
        <Translatable resourceKey={i18nKey("tokenTransfer.yourAccount", { token: networkName })} />
    </p>
    {#if account === undefined}
        {#if error !== undefined}
            <span class="error-label">{$_("cryptoAccount.failedToGenerateAddress")}</span>
        {:else}
            <span class="label">{$_("generating")}</span>
        {/if}
    {:else}
        <TruncatedAccount {centered} {account} />
    {/if}

    {#if selectedNetwork === BTC_SYMBOL}
        {#await btcDepositFeePromise.get()}
            <span class="label">{$_("cryptoAccount.fetchingDepositFee")}</span>
        {:then amount}
            <span class="label">{$_("cryptoAccount.depositFee", { values: { amount }})}</span>
        {:catch}
            <span class="error-label">{$_("cryptoAccount.failedToFetchDepositFee")}</span>
        {/await}
    {/if}
</div>

<style lang="scss">
    .centered {
        text-align: center;
    }

    .account-info {
        display: flex;
        flex-direction: column;
        margin-bottom: $sp4;
        align-items: center;
    }

    .your-account {
        margin-top: $sp4;
    }

    .generating {
        height: 298px;
        width: 298px;
        border: 1px solid var(--bd);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .spinner {
        @include loading-spinner(4rem, 2rem, var(--button-spinner), "/assets/spinner.svg");
        flex: 0 0 toRem(24);
    }

    .label {
        color: var(--unread-mute-txt);
    }

    .error-icon {
        background-image: url("/assets/dead-bot.svg");
        height: 4rem;
        width: 4rem;
    }

    .error-label {
        color: var(--error);
    }
</style>
