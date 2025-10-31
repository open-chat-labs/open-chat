<script lang="ts">
    import { Container, Sheet } from "component-lib";
    import {
        walletTokensSorted as accountsSorted,
        nervousSystemLookup,
        type OpenChat,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import AccountTransactions from "../profile/AccountTransactions.svelte";
    import ReceiveCrypto from "../profile/ReceiveCrypto.svelte";
    import RestrictedFeature from "../profile/RestrictedFeature.svelte";
    import SendCrypto from "../profile/SendCrypto.svelte";
    import SwapCrypto from "../profile/SwapCrypto.svelte";
    import WalletToken from "./WalletToken.svelte";
    import type { ConversionToken } from "./wallet";

    const client = getContext<OpenChat>("client");

    interface Props {
        selectedConversion?: ConversionToken;
    }

    let { selectedConversion = $bindable("usd") }: Props = $props();

    let balanceError: string | undefined = $state();
    let actionMode: "none" | "send" | "receive" | "swap" | "transactions" | "restricted" =
        $state("none");
    let selectedLedger: string | undefined = $state(undefined);
    let transactionsFormat: string = $state("");

    onMount(() => client.refreshSwappableTokens());

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
    let snsLedgers = $derived(
        new Set<string>(
            [...$nervousSystemLookup.values()]
                .filter((ns) => !ns.isNns)
                .map((ns) => ns.ledgerCanisterId),
        ),
    );
</script>

{#if actionMode !== "none" && selectedLedger !== undefined}
    <Sheet onDismiss={hideManageModal}>
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
    </Sheet>
{/if}

<Container gap={"sm"} height={{ kind: "fill" }} direction={"vertical"}>
    {#each $accountsSorted as token (token.ledger)}
        <WalletToken
            {selectedConversion}
            {token}
            {snsLedgers}
            onSend={showSend}
            onReceive={showReceive}
            onSwap={showSwap}
            onRemoveFromWallet={removeFromWallet}
            onTransactions={showTransactions} />
    {/each}
    <!-- <table>
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
            </tr>
        {/each}
    </table>
 -->
    {#if balanceError !== undefined}
        <ErrorMessage>{balanceError}</ErrorMessage>
    {/if}
</Container>

<style lang="scss">
    :global(.menu_trigger_clone > .wallet_token) {
        /* margin: 0 var(--sp-sm);
        padding: var(--sp-md) var(--sp-sm) !important; */
        border-radius: var(--rad-md) !important;
        background-color: var(--background-1) !important;
        box-shadow: var(--menu-sh);
        opacity: 1 !important;
    }

    :global(.manage .link-button) {
        padding: 0 0 0 $sp3;
        &:first-child {
            border-right: 1px solid var(--txt-light);
            padding: 0 $sp3 0 0;
        }
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
