<script lang="ts">
    import {
        type EnhancedTokenDetails,
        ICP_SYMBOL,
        type OpenChat,
        swappableTokensStore,
        walletTokensSorted as accountsSorted,
        walletConfigStore as walletConfig,
        nervousSystemLookup,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import HeartRemoveOutline from "svelte-material-icons/HeartRemoveOutline.svelte";
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
    import MultiToggle, { type Option } from "../../MultiToggle.svelte";
    import { sum } from "../../../utils/math";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import RestrictedFeature from "./RestrictedFeature.svelte";

    const client = getContext<OpenChat>("client");

    export let conversionOptions: Option[];
    export let selectedConversion: "none" | "usd" | "icp" | "btc" | "eth" = "none";

    let balanceError: string | undefined;
    let actionMode: "none" | "send" | "receive" | "swap" | "transactions" | "restricted";
    let selectedLedger: string | undefined = undefined;
    let transactionsFormat: string;

    $: manualWalletConfig = $walletConfig.kind === "manual_wallet";
    $: snsLedgers = new Set<string>(
        Object.values($nervousSystemLookup)
            .filter((ns) => !ns.isNns)
            .map((ns) => ns.ledgerCanisterId),
    );
    $: total =
        selectedConversion === "none" ? "" : calculateTotal($accountsSorted, selectedConversion);

    onMount(() => client.refreshSwappableTokens());

    function calculateTotal(
        accounts: EnhancedTokenDetails[],
        conversion: "usd" | "icp" | "btc" | "eth",
    ): string {
        switch (conversion) {
            case "usd":
                return sum(accounts.map((c) => c.dollarBalance ?? 0)).toFixed(2);
            case "icp":
                return sum(accounts.map((c) => c.icpBalance ?? 0)).toFixed(3);
            case "btc":
                return sum(accounts.map((c) => c.btcBalance ?? 0)).toFixed(6);
            case "eth":
                return sum(accounts.map((c) => c.ethBalance ?? 0)).toFixed(6);
        }
    }

    function onBalanceRefreshed() {
        balanceError = undefined;
    }

    function onBalanceRefreshError(ev: CustomEvent<string>) {
        balanceError = ev.detail;
    }

    function hideManageModal() {
        actionMode = "none";
    }

    function showReceive(ledger: string) {
        selectedLedger = ledger;
        actionMode = "receive";
    }

    function showSend(ledger: string) {
        selectedLedger = ledger;
        actionMode = "send";
    }

    function showSwap(ledger: string) {
        selectedLedger = ledger;
        client.swapRestricted().then((restricted) => {
            if (restricted) {
                actionMode = "restricted";
            } else {
                actionMode = "swap";
            }
        });
    }

    function showTransactions(token: { ledger: string; urlFormat: string }) {
        selectedLedger = token.ledger;
        transactionsFormat = token.urlFormat;
        actionMode = "transactions";
    }

    function removeFromWallet(ledger: string) {
        client.removeTokenFromWallet(ledger);
    }
</script>

{#if actionMode !== "none" && selectedLedger !== undefined}
    <Overlay
        dismissible={actionMode === "receive" || actionMode === "transactions"}
        on:close={hideManageModal}>
        {#if actionMode === "receive"}
            <ReceiveCrypto ledger={selectedLedger} on:close={hideManageModal} />
        {:else if actionMode === "send"}
            <SendCrypto ledger={selectedLedger} on:close={hideManageModal} />
        {:else if actionMode === "swap"}
            <SwapCrypto bind:ledgerIn={selectedLedger} on:close={hideManageModal} />
        {:else if actionMode === "transactions"}
            <AccountTransactions
                ledger={selectedLedger}
                on:close={hideManageModal}
                urlFormat={transactionsFormat} />
        {:else if actionMode === "restricted"}
            <RestrictedFeature on:close={hideManageModal} feature="swap" />
        {/if}
    </Overlay>
{/if}

<table>
    <thead>
        <tr>
            <th class="token-header"
                ><Translatable resourceKey={i18nKey("cryptoAccount.token")} /></th>
            <th class="balance-header" colspan="2">
                <MultiToggle options={conversionOptions} bind:selected={selectedConversion} />
            </th>
        </tr>
    </thead>
    {#each $accountsSorted as token}
        <tr>
            <td width="99%">
                <div class="token">
                    <img
                        alt={token.name}
                        class:disabled={!token.enabled}
                        class="icon"
                        src={token.logo} />
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
                                <MenuItem onclick={() => showSend(token.ledger)}>
                                    <ArrowRightBoldCircle
                                        size={$iconSize}
                                        color={"var(--icon-inverted-txt)"}
                                        slot="icon" />
                                    <div slot="text">
                                        <Translatable resourceKey={i18nKey("cryptoAccount.send")} />
                                    </div>
                                </MenuItem>
                                {#if token.enabled}
                                    <MenuItem onclick={() => showReceive(token.ledger)}>
                                        <ArrowLeftBoldCircle
                                            size={$iconSize}
                                            color={"var(--icon-inverted-txt)"}
                                            slot="icon" />
                                        <div slot="text">
                                            <Translatable
                                                resourceKey={i18nKey("cryptoAccount.receive")} />
                                        </div>
                                    </MenuItem>
                                    {#if $swappableTokensStore.has(token.ledger)}
                                        <MenuItem onclick={() => showSwap(token.ledger)}>
                                            <SwapIcon
                                                size={$iconSize}
                                                color={"var(--icon-inverted-txt)"}
                                                slot="icon" />
                                            <div slot="text">
                                                <Translatable
                                                    resourceKey={i18nKey("cryptoAccount.swap")} />
                                            </div>
                                        </MenuItem>
                                    {/if}
                                {/if}
                                {#if token.symbol === ICP_SYMBOL || snsLedgers.has(token.ledger)}
                                    <MenuItem onclick={() => showTransactions(token)}>
                                        <ViewList
                                            size={$iconSize}
                                            color={"var(--icon-inverted-txt)"}
                                            slot="icon" />
                                        <div slot="text">
                                            <Translatable
                                                resourceKey={i18nKey(
                                                    "cryptoAccount.transactions",
                                                )} />
                                        </div>
                                    </MenuItem>
                                {/if}
                                {#if manualWalletConfig}
                                    <MenuItem onclick={() => removeFromWallet(token.ledger)}>
                                        <HeartRemoveOutline
                                            size={$iconSize}
                                            color={"var(--icon-inverted-txt)"}
                                            slot="icon" />
                                        <div slot="text">
                                            <Translatable
                                                resourceKey={i18nKey("cryptoAccount.remove")} />
                                        </div>
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
                    <Translatable resourceKey={i18nKey("cryptoAccount.total")} />
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
            color: var(--txt-light);

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

            &.disabled {
                filter: grayscale(1);
            }
        }
    }
</style>
