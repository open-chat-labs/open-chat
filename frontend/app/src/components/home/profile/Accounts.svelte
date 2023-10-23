<script lang="ts">
    import type { CryptocurrencyDetails, OpenChat } from "openchat-client";
    import { dollarExchangeRates } from "openchat-client";
    import { getContext } from "svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import ManageCryptoAccount from "./ManageCryptoAccount.svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import ArrowRightBoldCircle from "svelte-material-icons/ArrowRightBoldCircle.svelte";
    import ArrowLeftBoldCircle from "svelte-material-icons/ArrowLeftBoldCircle.svelte";
    import ViewList from "svelte-material-icons/ViewList.svelte";
    import { _ } from "svelte-i18n";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import MenuIcon from "../../MenuIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import AccountTransactions from "./AccountTransactions.svelte";

    const client = getContext<OpenChat>("client");
    const defaultTokens = ["CHAT", "ICP", "ckBTC"];

    export let showZeroBalance = false;
    export let zeroCount = 0;

    let balanceError: string | undefined;
    let manageMode: "none" | "send" | "receive";
    let selectedLedger: string | undefined = undefined;
    let transactionsLedger: string | undefined = undefined;

    $: cryptoLookup = client.cryptoLookup;
    $: cryptoBalance = client.cryptoBalance;
    $: accounts = buildAccountsList($cryptoLookup, $cryptoBalance);

    $: {
        zeroCount = accounts.filter((a) => a.zero).length;
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

    function buildAccountsList(
        cryptoLookup: Record<string, CryptocurrencyDetails>,
        cryptoBalance: Record<string, bigint>
    ) {
        const accounts = Object.values(cryptoLookup).map((t) => {
            const balance = cryptoBalance[t.ledger] ?? BigInt(0);
            const xr = dollarExchangeRates[t.symbol.toLowerCase()];
            const dollarBalance = xr > 0 ? Number(balance) / xr : 0;
            const zero = balance === BigInt(0) && !defaultTokens.includes(t.symbol);
            return {
                key: t.ledger,
                ledger: t.ledger,
                symbol: t.symbol,
                balance,
                logo: t.logo,
                dollarBalance,
                zero,
            };
        });

        accounts.sort((a, b) => {
            // Sort by $ balance
            // Then by whether token is a default
            // Then by default precedence
            // Then alphabetically by symbol
            if (a.dollarBalance < b.dollarBalance) {
                return 1;
            } else if (a.dollarBalance > b.dollarBalance) {
                return -1;
            } else {
                const defA = defaultTokens.indexOf(a.symbol);
                const defB = defaultTokens.indexOf(b.symbol);

                if (defA >= 0 && defB >= 0) {
                    return defA < defB ? 1 : -1;
                } else if (defA >= 0) {
                    return 1;
                } else if (defB >= 0) {
                    return -1;
                } else {
                    return a.symbol.localeCompare(b.symbol);
                }
            }
        });

        return accounts;
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
    {#each accounts as token}
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
                                <MenuItem on:click={() => showSend(token.key)}>
                                    <ArrowRightBoldCircle
                                        size={$iconSize}
                                        color={"var(--icon-inverted-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("cryptoAccount.send")}</div>
                                </MenuItem>
                                <MenuItem on:click={() => showReceive(token.key)}>
                                    <ArrowLeftBoldCircle
                                        size={$iconSize}
                                        color={"var(--icon-inverted-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("cryptoAccount.receive")}</div>
                                </MenuItem>
                                {#if !["ckbtc"].includes(token.symbol.toLowerCase())}
                                    <MenuItem on:click={() => (transactionsLedger = token.ledger)}>
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

{#if transactionsLedger !== undefined}
    <AccountTransactions
        on:close={() => (transactionsLedger = undefined)}
        ledger={transactionsLedger} />
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
