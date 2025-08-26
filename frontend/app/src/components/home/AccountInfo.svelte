<script lang="ts">
    import {
        ARBITRUM_NETWORK,
        BASE_NETWORK,
        BTC_SYMBOL,
        CKBTC_SYMBOL,
        cryptoLookup,
        currentUserIdStore,
        currentUserStore,
        ETHEREUM_NETWORK,
        ICP_SYMBOL,
        Lazy,
        type OneSecTransferFees,
        OpenChat,
    } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import QRCode from "../QRCode.svelte";
    import Translatable from "../Translatable.svelte";
    import TruncatedAccount from "./TruncatedAccount.svelte";
    import NetworkSelector from "./NetworkSelector.svelte";
    import { rtlStore } from "../../stores/rtl";

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
    let selectedNetwork = $state<string>();
    let isBtc = $derived(tokenDetails.symbol === BTC_SYMBOL);
    let isBtcNetwork = $derived(selectedNetwork === BTC_SYMBOL);
    let isOneSec = $derived(tokenDetails.oneSecEnabled);
    let networks = $derived.by(() => {
        if (isBtc) {
            return [BTC_SYMBOL, CKBTC_SYMBOL];
        } else if (isOneSec) {
            return [ETHEREUM_NETWORK, ARBITRUM_NETWORK, BASE_NETWORK];
        } else {
            return [];
        }
    });
    let btcAddress = $state<string>();
    let oneSecAddress = $state<string>();

    // Whenever the networks list changes, autoselect the first one
    $effect(() => {
        selectedNetwork = networks[0];
    });

    let account = $derived.by(() => {
        if (tokenDetails.symbol === ICP_SYMBOL) {
            return $currentUserStore.cryptoAccount;
        } else if (isBtcNetwork) {
            return btcAddress;
        } else if (isOneSec) {
            return oneSecAddress;
        } else {
            return $currentUserIdStore;
        }
    });

    let error = $state();
    $effect(() => {
        if (account === undefined) {
            if (isBtcNetwork) {
                client.getBtcAddress().then((addr) => btcAddress = addr).catch((e) => error = e);
            } else if (isOneSec) {
                client.getOneSecAddress().then((addr) => oneSecAddress = addr).catch(e => error = e);
            }
        }
    });

    let tokenName = $derived.by(() => {
        if (isBtc) return selectedNetwork;
        if (selectedNetwork !== undefined) {
            return $rtlStore
                ? `(${selectedNetwork}) ${tokenDetails.symbol}`
                : `${tokenDetails.symbol} (${selectedNetwork})`;
        }
        return tokenDetails.symbol;
    });

    const btcDepositFeePromise = new Lazy(() => client.getCkbtcMinterDepositInfo()
        .then((depositInfo) => `~${client.formatTokens(depositInfo.depositFee, 8)}`));

    const oneSecFeesPromise = new Lazy(() => client.oneSecGetTransferFees()
        // Filter to where source token equals destination token since we're dealing with cross-chain deposits
        .then((fees) => oneSecFees = fees.filter((f) => f.sourceToken === f.destinationToken)));

    let oneSecFees = $state<OneSecTransferFees[]>();
    let oneSecFeesForToken = $derived.by(() => {
        if (!isOneSec || oneSecFees === undefined) return undefined;
        return oneSecFees.filter((f) => f.sourceToken === tokenDetails.symbol);
    });
    let oneSecProtocolFee = $derived.by(() => {
        if (oneSecFeesForToken === undefined) return undefined;
        return oneSecFeesForToken.find((f) => f.sourceChain === selectedNetwork && f.destinationChain === ICP_SYMBOL)?.protocolFeePercent;
    });
    let oneSecTransferFee = $derived.by(() => {
        if (oneSecFeesForToken === undefined) return undefined;
        return oneSecFeesForToken.find((f) => f.sourceChain === ICP_SYMBOL && f.destinationChain === selectedNetwork)?.latestTransferFee;
    });
    let oneSecTotalFee = $derived.by(() => {
        if (oneSecProtocolFee === undefined || oneSecTransferFee === undefined) return undefined;
        return `${oneSecProtocolFee}% + ~${client.formatTokens(oneSecTransferFee, tokenDetails.decimals)}`;
    });
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
        <QRCode {fullWidthOnMobile} text={account} size={qrSize} logo={tokenDetails.logo} {border} />
    {/if}
    <p class="your-account" class:centered>
        <Translatable resourceKey={i18nKey("tokenTransfer.yourAccount", { token: tokenName })} />
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
            <span class="label">{$_("cryptoAccount.networkFee", { values: { amount, token: tokenDetails.symbol }})}</span>
        {:catch}
            <span class="error-label">{$_("cryptoAccount.failedToFetchDepositFee")}</span>
        {/await}
    {:else if isOneSec}
        {#await oneSecFeesPromise.get()}
            <span class="label">{$_("cryptoAccount.fetchingDepositFee")}</span>
        {:then}
            {#if oneSecTotalFee !== undefined}
                <span class="label">{$_("cryptoAccount.networkFee", { values: { amount: oneSecTotalFee, token: tokenDetails.symbol }})}</span>
            {:else}
                <span class="error-label">{$_("cryptoAccount.failedToFetchDepositFee")}</span>
            {/if}
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
