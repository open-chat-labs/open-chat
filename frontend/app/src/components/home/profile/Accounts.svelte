<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import ManageCryptoAccount from "./ManageCryptoAccount.svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import ArrowRightBoldCircle from "svelte-material-icons/ArrowRightBoldCircle.svelte";
    import ArrowLeftBoldCircle from "svelte-material-icons/ArrowLeftBoldCircle.svelte";
    import SwapIcon from "svelte-material-icons/SwapHorizontal.svelte";
    import ViewList from "svelte-material-icons/ViewList.svelte";
    import { _ } from "svelte-i18n";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import MenuIcon from "../../MenuIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import AccountTransactions from "./AccountTransactions.svelte";

    type TransactionsFor = {
        ledger: string;
        urlFormat: string;
    };

    const client = getContext<OpenChat>("client");

    export let showZeroBalance = false;
    export let zeroCount = 0;

    let balanceError: string | undefined;
    let manageMode: "none" | "send" | "receive" | "swap";
    let selectedLedger: string | undefined = undefined;
    let transactionsFor: TransactionsFor | undefined = undefined;

    $: accounts = client.enhancedCryptoLookup;
    $: nervousSystemLookup = client.nervousSystemLookup;
    $: snsLedgers = new Set<string>(Object.values($nervousSystemLookup).filter((ns) => !ns.isNns).map((ns) => ns.ledgerCanisterId));

    $: {
        zeroCount = Object.values($accounts).filter((a) => a.zero).length;
    }

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

    function showSwap(ledger: string) {
        selectedLedger = ledger;
        manageMode = "swap";
    }
</script>

{#if manageMode !== "none" && selectedLedger !== undefined}
    <ManageCryptoAccount
        mode={manageMode}
        bind:ledger={selectedLedger}
        on:close={hideManageModal} />
{/if}

<table>
    <tr>
        <th class="token-header">{$_("cryptoAccount.token")}</th>
        <th class="balance-header">{$_("cryptoAccount.shortBalanceLabel")}</th>
        <th />
    </tr>
    {#each Object.values($accounts) as token}
        <tr class:hidden={token.zero && !showZeroBalance}>
            <td width="99%">
                <div class="token">
                    <img class="icon" src={token.logo} />
                    <div>
                        {token.symbol}
                    </div>
                </div>
            </td>
            <td>
                <BalanceWithRefresh
                    ledger={token.ledger}
                    value={token.balance}
                    on:refreshed={onBalanceRefreshed}
                    on:error={onBalanceRefreshError} />
            </td>
            <td>
                <div class="manage">
                    <MenuIcon position="bottom" align="end">
                        <span slot="icon" class="wallet-menu">
                            <ChevronDown
                                viewBox={"0 -3 24 24"}
                                size={$iconSize}
                                color={"var(--txt)"} />
                        </span>
                        <span slot="menu">
                            <Menu>
                                <MenuItem on:click={() => showSend(token.ledger)}>
                                    <ArrowRightBoldCircle
                                        size={$iconSize}
                                        color={"var(--icon-inverted-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("cryptoAccount.send")}</div>
                                </MenuItem>
                                <MenuItem on:click={() => showReceive(token.ledger)}>
                                    <ArrowLeftBoldCircle
                                        size={$iconSize}
                                        color={"var(--icon-inverted-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("cryptoAccount.receive")}</div>
                                </MenuItem>
                                {#await client.getTokenSwaps(token.ledger) then swaps}
                                    {#if Object.keys(swaps).length > 0}
                                        <MenuItem on:click={() => showSwap(token.ledger)}>
                                            <SwapIcon
                                                size={$iconSize}
                                                color={"var(--icon-inverted-txt)"}
                                                slot="icon" />
                                            <div slot="text">{$_("cryptoAccount.swap")}</div>
                                        </MenuItem>
                                    {/if}
                                {/await}
                                {#if snsLedgers.has(token.ledger)}
                                    <MenuItem on:click={() => (transactionsFor = token)}>
                                        <ViewList
                                            size={$iconSize}
                                            color={"var(--icon-inverted-txt)"}
                                            slot="icon" />
                                        <div slot="text">{$_("cryptoAccount.transactions")}</div>
                                    </MenuItem>
                                {/if}
                            </Menu>
                        </span>
                    </MenuIcon>
                </div>
            </td>
        </tr>
    {/each}
</table>

{#if balanceError !== undefined}
    <ErrorMessage>{balanceError}</ErrorMessage>
{/if}

{#if transactionsFor !== undefined}
    <AccountTransactions
        on:close={() => (transactionsFor = undefined)}
        ledger={transactionsFor.ledger}
        urlFormat={transactionsFor.urlFormat} />
{/if}

<style lang="scss">
    :global(.manage .link-button) {
        padding: 0 0 0 $sp3;
        &:first-child {
            border-right: 1px solid var(--txt-light);
            padding: 0 $sp3 0 0;
        }
    }

    .wallet-menu {
        cursor: pointer;
    }

    table {
        width: 100%;

        tr.hidden {
            display: none;
        }

        th {
            @include font(book, normal, fs-70);
            padding-bottom: $sp4;
            font-weight: 700;

            &.token-header {
                text-align: left;
            }

            &.balance-header {
                padding-right: 28px;
                text-align: right;
            }
        }

        td {
            vertical-align: middle;
            padding-bottom: $sp3;
        }

        .transactions {
            cursor: pointer;
            padding: 0 $sp2 0 0;
        }

        .token {
            display: flex;
            flex-direction: row;
            gap: toRem(10);
        }

        .manage {
            @include font(light, normal, fs-70);
            display: flex;
            padding-left: $sp3;
            text-wrap: nowrap;
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
