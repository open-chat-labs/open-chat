<script lang="ts">
    import { Cryptocurrency, cryptoCurrencyList, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import ManageCryptoAccount from "./ManageCryptoAccount.svelte";
    import { _ } from "svelte-i18n";
    import LinkButton from "../../LinkButton.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";

    const client = getContext<OpenChat>("client");

    let balanceError: string | undefined;
    let showManageCryptoAccount = false;
    let selectedCryptoAccount: Cryptocurrency | undefined = undefined;

    $: cryptoBalance = client.cryptoBalance;

    function onBalanceRefreshed() {
        balanceError = undefined;
    }

    function onBalanceRefreshError(ev: CustomEvent<string>) {
        balanceError = ev.detail;
    }

    function showManageCrypto(crypto: Cryptocurrency) {
        selectedCryptoAccount = crypto;
        showManageCryptoAccount = true;
    }

    $: crypto = cryptoCurrencyList.map((t, i) => ({
        symbol: t,
        balance: $cryptoBalance[t],
        disabled: !process.env.ENABLE_MULTI_CRYPTO && i > 0,
    }));
</script>

{#if showManageCryptoAccount && selectedCryptoAccount !== undefined}
    <ManageCryptoAccount bind:token={selectedCryptoAccount} bind:open={showManageCryptoAccount} />
{/if}

<div class="accounts">
    <div class="token-header">
        {$_("cryptoAccount.token")}
    </div>
    <div class="balance-header">
        {$_("cryptoAccount.shortBalanceLabel")}
    </div>
    <div />

    {#each crypto as token}
        <div class={`icon ${token.symbol}`} />

        <div class="token">
            {token.symbol.toUpperCase()}
            {#if token.disabled}
                <span class="coming-soon">{$_("cryptoAccount.comingSoon")}</span>
            {/if}
        </div>
        <div class="balance">
            <BalanceWithRefresh
                token={token.symbol}
                value={token.balance}
                disabled={token.disabled}
                on:refreshed={onBalanceRefreshed}
                on:error={onBalanceRefreshError} />
        </div>
        <div class="manage">
            {#if !token.disabled}
                <LinkButton underline={"hover"} on:click={() => showManageCrypto(token.symbol)}
                    >{$_("cryptoAccount.manage")}</LinkButton>
            {/if}
        </div>
    {/each}
</div>
{#if balanceError !== undefined}
    <ErrorMessage>{balanceError}</ErrorMessage>
{/if}

<style type="text/scss">
    .accounts {
        display: grid;
        grid-template-columns: 35px 1fr 1fr 60px;
        align-items: center;
        row-gap: $sp3;
        margin-bottom: $sp4;

        .token-header,
        .balance-header {
            @include font(book, normal, fs-70);
        }

        .token-header {
            font-weight: 700;
            grid-column: 1 / span 2;
            margin-bottom: $sp3;
        }

        .balance-header {
            padding-right: 28px;
            text-align: right;
            font-weight: 700;
            grid-column: 3 / span 1;
            margin-bottom: $sp3;
        }

        .manage {
            text-align: right;
            @include font(light, normal, fs-70);
            color: var(--txt-light);
        }

        .coming-soon {
            color: var(--txt-light);
            @include font(light, normal, fs-60);
        }

        .icon {
            background-size: contain;
            height: 24px;
            width: 24px;
            border-radius: 50%;
            background-repeat: no-repeat;
            background-position: top;
            &.icp {
                background-image: url("../assets/icp_token.png");
            }
            &.btc {
                background-image: url("../assets/bitcoin_token.png");
            }
            &.chat {
                background-image: url("../assets/chat_token.png");
            }
        }
    }
</style>
