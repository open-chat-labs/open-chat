<script lang="ts">
    import {
        type AccountTransactions,
        type OpenChat,
        type NamedAccount,
        toRecord,
        type AccountTransaction,
    } from "openchat-client";
    import type { RemoteData as RD } from "../../../utils/remoteData";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { toastStore } from "../../../stores/toast";
    import { _ } from "svelte-i18n";
    import ModalContent from "../../ModalContent.svelte";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import TransactionEndpoint from "./TransactionEndpoint.svelte";
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import CryptoSelector from "../CryptoSelector.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let ledger: string;
    export let urlFormat: string;

    type LoadingMore<T> = { kind: "loading_more"; data: T };
    type RemoteData = RD<AccountTransactions, string> | LoadingMore<AccountTransactions>;

    let transationData: RemoteData = { kind: "loading" };
    let accounts: NamedAccount[] = [];
    $: accountLookup = toRecord(accounts, (a) => a.account);
    $: cryptoLookup = client.cryptoLookup;
    $: tokenDetails = $cryptoLookup[ledger];
    $: nervousSystemLookup = client.nervousSystemLookup;
    $: snsLedgers = new Set<string>(
        Object.values($nervousSystemLookup)
            .filter((ns) => !ns.isNns)
            .map((ns) => ns.ledgerCanisterId),
    );
    $: moreAvailable = moreTransactionsAvailable(transationData);
    $: loading = transationData.kind === "loading" || transationData.kind === "loading_more";

    function moreTransactionsAvailable(trans: RemoteData): boolean {
        if (trans.kind !== "success") return false;
        if (trans.data.oldestTransactionId === undefined) return false;
        const lastLoaded = trans.data.transactions[trans.data.transactions.length - 1];
        return lastLoaded.id > trans.data.oldestTransactionId;
    }

    onMount(async () => {
        accounts = await client.loadSavedCryptoAccounts();
        loadTransations();
    });

    function url(id: bigint): string {
        return urlFormat
            .replace("{block_index}", id.toString())
            .replace("{transaction_index}", id.toString())
            .replace("{transaction_hash}", "");
    }

    function openDashboard(id: bigint) {
        window.open(url(id), "_blank");
    }

    function ledgerSelected(ev: CustomEvent<{ ledger: string; urlFormat: string }>): void {
        transationData = { kind: "idle" };
        ledger = ev.detail.ledger;
        urlFormat = ev.detail.urlFormat;
        loadTransations();
    }

    function translateMemo(trans: AccountTransaction): string {
        switch (trans.memo) {
            case "OC_MSG":
                return "MESSAGE";
            case "OC_SEND":
                return "TRANSFER";
            case "OC_TIP":
                return "TIP";
            case "OC_PRZ":
                return "PRIZE";
            case "OC_PRZCL":
                return "PRIZE CLAIM";
            case "OC_PRZRF":
                return "PRIZE REFUND";

            default:
                return $_("cryptoAccount.unknownTransactionType");
        }
    }

    function loadTransations() {
        const nervousSystem = Object.values($nervousSystemLookup).find(
            (n) => n.ledgerCanisterId === ledger,
        );
        const ledgerIndex = nervousSystem?.indexCanisterId;
        if (ledgerIndex !== undefined) {
            let start = undefined;
            if (transationData.kind === "success") {
                start =
                    transationData.data.transactions[transationData.data.transactions.length - 1]
                        .id - 1n;
                transationData = { kind: "loading_more", data: transationData.data };
            } else {
                transationData = { kind: "loading" };
            }
            client
                .getAccountTransactions(ledgerIndex, start)
                .then((result) => {
                    if (result.kind === "failure") {
                        transationData = { kind: "idle" };
                        toastStore.showFailureToast($_("cryptoAccount.transactionError"));
                    } else {
                        if (transationData.kind === "loading") {
                            transationData = { kind: "success", data: result };
                        }
                        if (transationData.kind === "loading_more") {
                            transationData = {
                                kind: "success",
                                data: {
                                    oldestTransactionId: result.oldestTransactionId,
                                    transactions: [
                                        ...transationData.data.transactions,
                                        ...result.transactions,
                                    ],
                                },
                            };
                        }
                    }
                })
                .catch((err) => {
                    console.warn("Error loading transactions: ", err);
                    transationData = { kind: "idle" };
                    toastStore.showFailureToast($_("cryptoAccount.transactionError"));
                });
        } else {
            toastStore.showFailureToast($_("cryptoAccount.transactionError"));
            transationData = { kind: "idle" };
            console.warn("Could not find ledger index for ledger", ledger, $nervousSystemLookup);
        }
    }
</script>

<ModalContent fitToContent={!$mobileWidth} closeIcon on:close>
    <div class="header" slot="header">
        <div class="main-title">
            <div>{$_("cryptoAccount.transactions")}</div>
            <div>
                <CryptoSelector
                    filter={(t) => snsLedgers.has(t.ledger)}
                    on:select={ledgerSelected}
                    {ledger} />
            </div>
        </div>
    </div>
    <div slot="body" class="table-container">
        <div class="table-scroll">
            <table class="data">
                <thead>
                    <tr>
                        <th>{$_("cryptoAccount.transactionHeaders.id")}</th>
                        <th>{$_("cryptoAccount.transactionHeaders.amount")}</th>
                        <th>{$_("cryptoAccount.transactionHeaders.type")}</th>
                        <th>{$_("cryptoAccount.transactionHeaders.timestamp")}</th>
                        <th>{$_("cryptoAccount.transactionHeaders.from")}</th>
                        <th>{$_("cryptoAccount.transactionHeaders.to")}</th>
                    </tr>
                </thead>
                <tbody>
                    {#if transationData.kind === "success" || transationData.kind === "loading_more"}
                        {#each transationData.data.transactions as transaction (transaction.id)}
                            <tr on:click={() => openDashboard(transaction.id)}>
                                <td>{transaction.id}</td>
                                <td
                                    >{client.formatTokens(
                                        transaction.amount,
                                        tokenDetails.decimals,
                                    )}</td>
                                <td class="truncate">{translateMemo(transaction)}</td>
                                <td>{client.toDatetimeString(transaction.timestamp)}</td>
                                <td class="truncate">
                                    <TransactionEndpoint
                                        accounts={accountLookup}
                                        address={transaction.from} />
                                </td>
                                <td class="truncate">
                                    <TransactionEndpoint
                                        accounts={accountLookup}
                                        address={transaction.to} />
                                </td>
                            </tr>
                        {/each}
                    {:else if transationData.kind === "loading"}
                        <div class="loading">
                            <FancyLoader />
                        </div>
                    {/if}
                </tbody>
            </table>
        </div>
    </div>
    <div slot="footer">
        <div class="footer">
            <ButtonGroup>
                <Button
                    secondary
                    on:click={() => loadTransations()}
                    disabled={!moreAvailable && !loading}
                    {loading}
                    small={!$mobileWidth}
                    tiny={$mobileWidth}>
                    {$_("cryptoAccount.loadMoreTransactions")}
                </Button>
                <Button
                    on:click={() => dispatch("close")}
                    small={!$mobileWidth}
                    tiny={$mobileWidth}>
                    {$_("close")}
                </Button>
            </ButtonGroup>
        </div>
    </div>
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
        background-color: var(--button-bg);
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
