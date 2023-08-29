<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import ManageCryptoAccount from "./ManageCryptoAccount.svelte";
    import { _ } from "svelte-i18n";
    import LinkButton from "../../LinkButton.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";

    const client = getContext<OpenChat>("client");

    let balanceError: string | undefined;
    let manageMode: "none" | "send" | "receive";
    let selectedLedger: string | undefined = undefined;

    $: cryptoLookup = client.cryptoLookup;
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

    function showReceive(ledger: string) {
        selectedLedger = ledger;
        manageMode = "receive";
    }

    function showSend(ledger: string) {
        selectedLedger = ledger;
        manageMode = "send";
    }

    $: crypto = Object.values($cryptoLookup).map((t) => ({
        key: t.ledger,
        ledger: t.ledger,
        symbol: t.symbol,
        balance: $cryptoBalance[t.ledger] ?? BigInt(0),
        logo: t.logo,
    }));

    $: {
        crypto.sort((a, b) => {
            if (a.balance < b.balance) {
                return 1;
            } else if (a.balance > b.balance) {
                return -1;
            } else {
                return 0;
            }
        });
    }
</script>

{#if manageMode !== "none" && selectedLedger !== undefined}
    <ManageCryptoAccount
        mode={manageMode}
        bind:ledger={selectedLedger}
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
        <img class="icon" src={token.logo} />

        <div class="token">
            {token.symbol}
        </div>
        <div class="balance">
            <BalanceWithRefresh
                ledger={token.ledger}
                value={token.balance}
                on:refreshed={onBalanceRefreshed}
                on:error={onBalanceRefreshError} />
        </div>
        <div class="manage">
            <LinkButton underline={"hover"} on:click={() => showSend(token.key)}
                >{$_("cryptoAccount.send")}</LinkButton>
            <LinkButton underline={"hover"} on:click={() => showReceive(token.key)}
                >{$_("cryptoAccount.receive")}</LinkButton>
        </div>
    {/each}
</div>
{#if balanceError !== undefined}
    <ErrorMessage>{balanceError}</ErrorMessage>
{/if}

<style lang="scss">
    :global(.manage .link-button) {
        padding: 0 0 0 $sp3;
        &:first-child {
            border-right: 1px solid var(--txt-light);
            padding: 0 $sp3 0 0;
        }
    }

    .accounts {
        display: grid;
        grid-template-columns: 35px 1fr 1fr auto;
        align-items: center;
        row-gap: toRem(10);
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
            @include font(light, normal, fs-70);
            color: var(--txt-light);
            display: flex;
            padding-left: $sp3;
        }

        .icon {
            background-size: contain;
            height: 24px;
            width: 24px;
            border-radius: 50%;
            background-repeat: no-repeat;
            background-position: top;
        }
    }
</style>
