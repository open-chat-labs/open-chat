<script lang="ts">
    import {
        walletTokensSorted as accountsSorted,
        app,
        type EnhancedTokenDetails,
        ICP_SYMBOL,
        nervousSystemLookup,
        type OpenChat,
        swappableTokensStore,
        ui,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import ArrowLeftBoldCircle from "svelte-material-icons/ArrowLeftBoldCircle.svelte";
    import ArrowRightBoldCircle from "svelte-material-icons/ArrowRightBoldCircle.svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import HeartRemoveOutline from "svelte-material-icons/HeartRemoveOutline.svelte";
    import SwapIcon from "svelte-material-icons/SwapHorizontal.svelte";
    import ViewList from "svelte-material-icons/ViewList.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { sum } from "../../../utils/math";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Menu from "../../Menu.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import MultiToggle, { type Option } from "../../MultiToggle.svelte";
    import Overlay from "../../Overlay.svelte";
    import Translatable from "../../Translatable.svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import AccountTransactions from "./AccountTransactions.svelte";
    import ReceiveCrypto from "./ReceiveCrypto.svelte";
    import RestrictedFeature from "./RestrictedFeature.svelte";
    import SendCrypto from "./SendCrypto.svelte";
    import SwapCrypto from "./SwapCrypto.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        conversionOptions: Option[];
        selectedConversion?: "none" | "usd" | "icp" | "btc" | "eth";
        hideTokenBalances?: boolean;
    }

    let {
        conversionOptions,
        selectedConversion = $bindable("none"),
        hideTokenBalances = false,
    }: Props = $props();

    let balanceError: string | undefined = $state();
    let actionMode: "none" | "send" | "receive" | "swap" | "transactions" | "restricted" =
        $state("none");
    let selectedLedger: string | undefined = $state(undefined);
    let transactionsFormat: string = $state("");

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

    function onBalanceRefreshError(err: string) {
        balanceError = err;
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
    let manualWalletConfig = $derived(app.walletConfig.kind === "manual_wallet");
    let snsLedgers = $derived(
        new Set<string>(
            Object.values($nervousSystemLookup)
                .filter((ns) => !ns.isNns)
                .map((ns) => ns.ledgerCanisterId),
        ),
    );
    let total = $derived(
        selectedConversion === "none" ? "" : calculateTotal($accountsSorted, selectedConversion),
    );
</script>

{#if actionMode !== "none" && selectedLedger !== undefined}
    <Overlay
        dismissible={actionMode === "receive" || actionMode === "transactions"}
        onClose={hideManageModal}>
        {#if actionMode === "receive"}
            <ReceiveCrypto ledger={selectedLedger} onClose={hideManageModal} />
        {:else if actionMode === "send"}
            <SendCrypto ledger={selectedLedger} onClose={hideManageModal} />
        {:else if actionMode === "swap"}
            <SwapCrypto bind:ledgerIn={selectedLedger} onClose={hideManageModal} />
        {:else if actionMode === "transactions"}
            <AccountTransactions
                ledger={selectedLedger}
                onClose={hideManageModal}
                urlFormat={transactionsFormat} />
        {:else if actionMode === "restricted"}
            <RestrictedFeature onClose={hideManageModal} feature="swap" />
        {/if}
    </Overlay>
{/if}

<table>
    <thead>
        <tr>
            <th class="token-header"
                ><Translatable resourceKey={i18nKey("cryptoAccount.token")} /></th>
            <th class="balance-header" colspan="2" class:hideTokenBalances>
                <MultiToggle options={conversionOptions} bind:selected={selectedConversion} />
            </th>
        </tr>
    </thead>
    {#each $accountsSorted as token (token.ledger)}
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
                    hideBalance={hideTokenBalances}
                    allowCached={true}
                    onRefreshed={onBalanceRefreshed}
                    onError={onBalanceRefreshError} />
            </td>
            <td class="manage-col">
                <div class="manage">
                    <MenuIcon position="bottom" align="end">
                        {#snippet menuIcon()}
                            <span class="wallet-menu">
                                <ChevronDown
                                    viewBox={"0 -3 24 24"}
                                    size={ui.iconSize}
                                    color={"var(--txt)"} />
                            </span>
                        {/snippet}
                        {#snippet menuItems()}
                            <Menu>
                                <MenuItem onclick={() => showSend(token.ledger)}>
                                    {#snippet icon()}
                                        <ArrowRightBoldCircle
                                            size={ui.iconSize}
                                            color={"var(--icon-inverted-txt)"} />
                                    {/snippet}
                                    {#snippet text()}
                                        <div>
                                            <Translatable
                                                resourceKey={i18nKey("cryptoAccount.send")} />
                                        </div>
                                    {/snippet}
                                </MenuItem>
                                {#if token.enabled}
                                    <MenuItem onclick={() => showReceive(token.ledger)}>
                                        {#snippet icon()}
                                            <ArrowLeftBoldCircle
                                                size={ui.iconSize}
                                                color={"var(--icon-inverted-txt)"} />
                                        {/snippet}
                                        {#snippet text()}
                                            <div>
                                                <Translatable
                                                    resourceKey={i18nKey(
                                                        "cryptoAccount.receive",
                                                    )} />
                                            </div>
                                        {/snippet}
                                    </MenuItem>
                                    {#if $swappableTokensStore.has(token.ledger)}
                                        <MenuItem onclick={() => showSwap(token.ledger)}>
                                            {#snippet icon()}
                                                <SwapIcon
                                                    size={ui.iconSize}
                                                    color={"var(--icon-inverted-txt)"} />
                                            {/snippet}
                                            {#snippet text()}
                                                <div>
                                                    <Translatable
                                                        resourceKey={i18nKey(
                                                            "cryptoAccount.swap",
                                                        )} />
                                                </div>
                                            {/snippet}
                                        </MenuItem>
                                    {/if}
                                {/if}
                                {#if token.symbol === ICP_SYMBOL || snsLedgers.has(token.ledger)}
                                    <MenuItem onclick={() => showTransactions(token)}>
                                        {#snippet icon()}
                                            <ViewList
                                                size={ui.iconSize}
                                                color={"var(--icon-inverted-txt)"} />
                                        {/snippet}
                                        {#snippet text()}
                                            <div>
                                                <Translatable
                                                    resourceKey={i18nKey(
                                                        "cryptoAccount.transactions",
                                                    )} />
                                            </div>
                                        {/snippet}
                                    </MenuItem>
                                {/if}
                                {#if manualWalletConfig}
                                    <MenuItem onclick={() => removeFromWallet(token.ledger)}>
                                        {#snippet icon()}
                                            <HeartRemoveOutline
                                                size={ui.iconSize}
                                                color={"var(--icon-inverted-txt)"} />
                                        {/snippet}
                                        {#snippet text()}
                                            <div>
                                                <Translatable
                                                    resourceKey={i18nKey("cryptoAccount.remove")} />
                                            </div>
                                        {/snippet}
                                    </MenuItem>
                                {/if}
                            </Menu>
                        {/snippet}
                    </MenuIcon>
                </div>
            </td>
        </tr>
    {/each}
    {#if selectedConversion !== "none" && !hideTokenBalances}
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

        .hideTokenBalances {
            visibility: hidden;
        }
    }
</style>
