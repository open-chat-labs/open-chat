<script lang="ts">
    import { Cryptocurrency, cryptoCurrencyList, cryptoLookup, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import ManageCryptoAccount from "./ManageCryptoAccount.svelte";
    import { _ } from "svelte-i18n";
    import LinkButton from "../../LinkButton.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";

    const client = getContext<OpenChat>("client");

    let balanceError: string | undefined;
    let manageMode: "none" | "send" | "deposit";
    let selectedCryptoAccount: Cryptocurrency | undefined = undefined;

    $: cryptoBalance = client.cryptoBalance;

    function onBalanceRefreshed() {
        balanceError = undefined;
    }

    function onBalanceRefreshError(ev: CustomEvent<string>) {
        balanceError = ev.detail;
    }

    function hideManageModal() {
        manageMode = "none";
    }

    function showReceive(crypto: Cryptocurrency) {
        selectedCryptoAccount = crypto;
        manageMode = "deposit";
    }

    function showSend(crypto: Cryptocurrency) {
        selectedCryptoAccount = crypto;
        manageMode = "send";
    }

    $: crypto = cryptoCurrencyList.map((t) => ({
        key: t,
        symbol: cryptoLookup[t].symbol,
        balance: $cryptoBalance[t],
        disabled: cryptoLookup[t].disabled,
    }));
</script>

{#if manageMode !== "none" && selectedCryptoAccount !== undefined}
    <ManageCryptoAccount
        mode={manageMode}
        bind:token={selectedCryptoAccount}
        on:close={hideManageModal} />
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
        <div class={`icon ${token.key}`} />

        <div class="token">
            {token.symbol}
            {#if token.disabled}
                <span class="coming-soon">{$_("cryptoAccount.comingSoon")}</span>
            {/if}
        </div>
        <div class="balance">
            <BalanceWithRefresh
                token={token.key}
                value={token.balance}
                disabled={token.disabled}
                on:refreshed={onBalanceRefreshed}
                on:error={onBalanceRefreshError} />
        </div>
        <div class="manage">
            {#if !token.disabled}
                <LinkButton underline={"hover"} on:click={() => showSend(token.key)}
                    >{$_("cryptoAccount.send")}</LinkButton>
                <LinkButton underline={"hover"} on:click={() => showReceive(token.key)}
                    >{$_("cryptoAccount.deposit")}</LinkButton>
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
            &.sns1 {
                background-image: url("../assets/sns1_token.png");
            }
            &.ckbtc {
                background-image: url("../assets/bitcoin_token2.jpeg");
            }
            &.chat {
                background-image: url("../assets/spinner.svg");
            }
        }
    }
</style>
