<script lang="ts">
    import type { EnhancedTokenDetails, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
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
    import Overlay from "../../Overlay.svelte";
    import SwapCrypto from "./SwapCrypto.svelte";
    import SendCrypto from "./SendCrypto.svelte";
    import ReceiveCrypto from "./ReceiveCrypto.svelte";
    import MultiToggle from "../../MultiToggle.svelte";
    import { sum } from "../../../utils/math";

    const client = getContext<OpenChat>("client");

    export let showZeroBalance = false;
    export let zeroCount = 0;

    let balanceError: string | undefined;
    let manageMode: "none" | "send" | "receive" | "swap" | "transactions";
    let selectedLedger: string | undefined = undefined;
    let transactionsFormat: string;
    let conversionOptions = [
        { id: "none", label: $_("cryptoAccount.tokens") },
        { id: "usd", label: "USD" },
        { id: "icp", label: "ICP" },
    ];
    let selectedConversion: "none" | "icp" | "usd" = "none";

    $: accountsSorted = client.cryptoTokensSorted;
    $: nervousSystemLookup = client.nervousSystemLookup;
    $: cryptoLookup = client.enhancedCryptoLookup;
    $: snsLedgers = new Set<string>(
        Object.values($nervousSystemLookup)
            .filter((ns) => !ns.isNns)
            .map((ns) => ns.ledgerCanisterId),
    );
    $: total =
        selectedConversion === "none"
            ? ""
            : selectedConversion === "usd"
              ? calculateTotalUSD($cryptoLookup)
              : calculateTotalICP($cryptoLookup);

    $: {
        zeroCount = $accountsSorted.filter((a) => a.zero).length;
    }

    function calculateTotalUSD(lookup: Record<string, EnhancedTokenDetails>): string {
        return sum(Object.values(lookup).map((c) => c.dollarBalance)).toFixed(2);
    }

    function calculateTotalICP(lookup: Record<string, EnhancedTokenDetails>): string {
        return sum(Object.values(lookup).map((c) => c.icpBalance)).toFixed(3);
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

    function showTransactions(token: { ledger: string; urlFormat: string }) {
        selectedLedger = token.ledger;
        transactionsFormat = token.urlFormat;
        manageMode = "transactions";
    }
</script>

{#if manageMode !== "none" && selectedLedger !== undefined}
    <Overlay
        dismissible={manageMode === "receive" || manageMode === "transactions"}
        on:close={hideManageModal}>
        {#if manageMode === "receive"}
            <ReceiveCrypto ledger={selectedLedger} on:close={hideManageModal} />
        {:else if manageMode === "send"}
            <SendCrypto ledger={selectedLedger} on:close={hideManageModal} />
        {:else if manageMode === "swap"}
            <SwapCrypto bind:ledgerIn={selectedLedger} on:close={hideManageModal} />
        {:else if manageMode === "transactions"}
            <AccountTransactions
                ledger={selectedLedger}
                on:close={hideManageModal}
                urlFormat={transactionsFormat} />
        {/if}
    </Overlay>
{/if}

<table>
    <tr>
        <th class="token-header">{$_("cryptoAccount.token")}</th>
        <th class="balance-header" colspan="2">
            <MultiToggle options={conversionOptions} bind:selected={selectedConversion} />
        </th>
    </tr>
    {#each $accountsSorted as token}
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
                    conversion={selectedConversion}
                    on:refreshed={onBalanceRefreshed}
                    on:error={onBalanceRefreshError} />
            </td>
            <td class="manage-col">
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
                                    <MenuItem on:click={() => showTransactions(token)}>
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
    {#if selectedConversion !== "none"}
        <tr class="total">
            <td>
                <div class="token">
                    <div class="icon"></div>
                    {$_("cryptoAccount.total")}
                </div>
            </td>
            <td class="total">{total}</td>
            <td></td>
        </tr>
    {/if}
</table>

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

            &.token-header {
                font-weight: 700;
                text-align: left;
            }

            &.balance-header {
                @include font-size(fs-60);
                text-transform: uppercase;
            }
        }

        td {
            vertical-align: middle;
            padding-bottom: $sp3;

            &.manage-col {
                width: 0;
            }

            &.total {
                @include font(bold, normal, fs-100, 22);
                padding-right: 30px;
                text-align: right;
            }
        }

        tr.total {
            color: var(--disabledTxt);

            td {
                padding-top: $sp3;
                border-top: solid 1px var(--bd);
            }
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
