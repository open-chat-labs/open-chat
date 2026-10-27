<script lang="ts">
    import { type OpenChat, cryptoLookup, currentUserStore, mobileWidth } from "@client";
    import {
        accountTransactionUrl,
        transactionMemoKey,
    } from "@src/logic/wallet/accountTransactions";
    import { TransactionHistoryState } from "@src/logic/wallet/transactionHistoryState.svelte";
    import { getContext, onMount, untrack } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import CryptoSelector from "../CryptoSelector.svelte";
    import TransactionEndpoint from "./TransactionEndpoint.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        ledger: string;
        urlFormat: string;
        onClose: () => void;
    }

    let { ledger = $bindable(), urlFormat = $bindable(), onClose }: Props = $props();

    // the token's history, a page at a time (TransactionHistoryState, shared with every tree)
    let history = $state(untrack(() => historyFor(ledger)));

    function historyFor(l: string): TransactionHistoryState {
        return new TransactionHistoryState(client, $cryptoLookup.get(l)?.index);
    }

    onMount(() => {
        // the saved account names the from / to cells show (namedAccountsStore)
        client.loadSavedCryptoAccounts();
        load();
    });

    async function load() {
        const loading = history;
        await loading.load();
        if (loading === history && loading.state.kind === "failed") {
            toastStore.showFailureToast(i18nKey("cryptoAccount.transactionError"));
        }
    }

    async function loadMore() {
        if ((await history.loadMore()) === "failed") {
            toastStore.showFailureToast(i18nKey("cryptoAccount.transactionError"));
        }
    }

    function openDashboard(id: bigint) {
        window.open(accountTransactionUrl(urlFormat, id), "_blank");
    }

    function ledgerSelected(l: string, u: string): void {
        ledger = l;
        urlFormat = u;
        history = historyFor(l);
        load();
    }

    let tokenDetails = $derived($cryptoLookup.get(ledger)!);
    let tokensWithIndexes = $derived(
        new Set<string>(
            [...$cryptoLookup.values()].filter((t) => t.index !== undefined).map((t) => t.ledger),
        ),
    );
    let shown = $derived(history.state);
    let loading = $derived(
        shown.kind === "loading" || (shown.kind === "loaded" && shown.loadingMore),
    );
</script>

<ModalContent fitToContent={!$mobileWidth} closeIcon {onClose}>
    {#snippet header()}
        <div class="header">
            <div class="main-title">
                <div><Translatable resourceKey={i18nKey("cryptoAccount.transactions")} /></div>
                <div>
                    <CryptoSelector
                        filter={(t) => tokensWithIndexes.has(t.ledger)}
                        onSelect={ledgerSelected}
                        {ledger} />
                </div>
            </div>
        </div>
    {/snippet}
    {#snippet body()}
        <div class="table-container">
            <div class="table-scroll">
                <table class="data">
                    <thead>
                        <tr>
                            <th
                                ><Translatable
                                    resourceKey={i18nKey(
                                        "cryptoAccount.transactionHeaders.id",
                                    )} /></th>
                            <th
                                ><Translatable
                                    resourceKey={i18nKey(
                                        "cryptoAccount.transactionHeaders.amount",
                                    )} /></th>
                            <th
                                ><Translatable
                                    resourceKey={i18nKey(
                                        "cryptoAccount.transactionHeaders.type",
                                    )} /></th>
                            <th
                                ><Translatable
                                    resourceKey={i18nKey(
                                        "cryptoAccount.transactionHeaders.timestamp",
                                    )} /></th>
                            <th
                                ><Translatable
                                    resourceKey={i18nKey(
                                        "cryptoAccount.transactionHeaders.from",
                                    )} /></th>
                            <th
                                ><Translatable
                                    resourceKey={i18nKey(
                                        "cryptoAccount.transactionHeaders.to",
                                    )} /></th>
                        </tr>
                    </thead>
                    <tbody>
                        {#if shown.kind === "loaded"}
                            {#each shown.history.transactions as transaction (transaction.id)}
                                <tr onclick={() => openDashboard(transaction.id)}>
                                    <td>{transaction.id}</td>
                                    <td
                                        >{client.formatTokens(
                                            transaction.amount,
                                            tokenDetails.decimals,
                                        )}</td>
                                    <td class="truncate"
                                        ><Translatable
                                            resourceKey={transactionMemoKey(
                                                transaction.memo,
                                            )} /></td>
                                    <td>{client.toDatetimeString(transaction.timestamp)}</td>
                                    <td class="truncate">
                                        <TransactionEndpoint
                                            address={transaction.from}
                                            currentUser={$currentUserStore} />
                                    </td>
                                    <td class="truncate">
                                        <TransactionEndpoint
                                            address={transaction.to}
                                            currentUser={$currentUserStore} />
                                    </td>
                                </tr>
                            {/each}
                        {:else if shown.kind === "loading"}
                            <div class="loading">
                                <FancyLoader />
                            </div>
                        {/if}
                    </tbody>
                </table>
            </div>
        </div>
    {/snippet}
    {#snippet footer()}
        <div>
            <div class="footer">
                <ButtonGroup>
                    <Button
                        secondary
                        onClick={loadMore}
                        disabled={!history.moreAvailable && !loading}
                        {loading}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}>
                        <Translatable resourceKey={i18nKey("cryptoAccount.loadMoreTransactions")} />
                    </Button>
                    <Button onClick={onClose} small={!$mobileWidth} tiny={$mobileWidth}>
                        <Translatable resourceKey={i18nKey("close")} />
                    </Button>
                </ButtonGroup>
            </div>
        </div>
    {/snippet}
</ModalContent>

<style lang="scss">
    .table-container {
        height: 400px;
        overflow: hidden;
        border: 1px solid var(--bd);
    }
    .table-scroll {
        overflow-y: auto;
        height: 100%;
    }
    tbody {
        position: relative;
    }
    thead {
        position: sticky;
        top: 0;
        z-index: 1;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        min-width: 600px; // this will scroll horizontally on mobile
    }
    tr {
        border-bottom: 1px solid var(--bd);
    }
    td,
    th {
        border-right: 1px solid var(--bd);
        &:last-child {
            border-right: none;
        }
    }

    th,
    td {
        padding: 8px;
        text-align: left;
    }
    th {
        background: var(--button-bg);
        color: var(--button-txt);
    }
    tr {
        cursor: pointer;
    }
    tr:hover {
        background-color: rgba(255, 255, 255, 0.1);
    }
    td:nth-child(2),
    th:nth-child(2) {
        text-align: right;
    }
    .truncate {
        max-width: 150px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .loading {
        width: 80px;
        height: 80px;
        top: 140px;
        left: 50%;
        transform: translateX(-50%);
        position: absolute;
    }
    .main-title {
        flex: auto;
        display: flex;
        align-items: baseline;
        gap: 10px;
        @include font(bold, normal, fs-120);
    }
</style>
