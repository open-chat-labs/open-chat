<script lang="ts">
    import ViewList from "svelte-material-icons/ViewList.svelte";
    import { E8S_PER_TOKEN, type AccountTransactions, type OpenChat } from "openchat-client";
    import type { RemoteData } from "../../../utils/remoteData";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { toastStore } from "../../../stores/toast";
    import { _ } from "svelte-i18n";
    import ModalContent from "../../ModalContent.svelte";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import Overlay from "../../Overlay.svelte";
    import TransactionEndpoint from "./TransactionEndpoint.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let ledger: string;

    let transationData: RemoteData<AccountTransactions, string> = { kind: "loading" };

    $: nervousSystemLookup = client.nervousSystemLookup;

    onMount(showTransactions);

    function showTransactions() {
        const nervousSystem = Object.values($nervousSystemLookup).find(
            (n) => n.ledgerCanisterId === ledger
        );
        const ledgerIndex = nervousSystem?.indexCanisterId;
        if (ledgerIndex !== undefined) {
            transationData = { kind: "loading" };
            client
                .getAccountTransactions(ledgerIndex)
                .then((result) => {
                    if (result.kind === "failure") {
                        transationData = { kind: "idle" };
                        toastStore.showFailureToast($_("cryptoAccount.transactionError"));
                    } else {
                        transationData = { kind: "success", data: result };
                    }
                })
                .catch((err) => {
                    console.warn("Error loading transactions: ", err);
                    transationData = { kind: "idle" };
                    toastStore.showFailureToast($_("cryptoAccount.transactionError"));
                });
        } else {
            console.debug(
                "TRN: could not find ledger index for ledger",
                ledger,
                $nervousSystemLookup
            );
        }
    }

    function fromE8s(e8s: bigint): number {
        return Number(e8s) / E8S_PER_TOKEN;
    }
</script>

<Overlay dismissible on:close={() => dispatch("close")}>
    <ModalContent fitToContent closeIcon on:close>
        <div class="header" slot="header">
            <ViewList size={"1.2em"} color={"var(--txt)"} />
            {$_("cryptoAccount.transactions")}
        </div>
        <div slot="body">
            {#if transationData.kind === "success"}
                <table class="data">
                    <thead>
                        <tr>
                            <th>{$_("cryptoAccount.transactionHeaders.id")}</th>
                            <th>{$_("cryptoAccount.transactionHeaders.amount")}</th>
                            <th>{$_("cryptoAccount.transactionHeaders.kind")}</th>
                            <th>{$_("cryptoAccount.transactionHeaders.timestamp")}</th>
                            <th>{$_("cryptoAccount.transactionHeaders.from")}</th>
                            <th>{$_("cryptoAccount.transactionHeaders.to")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each transationData.data.transactions as transaction}
                            <tr>
                                <td>{transaction.id}</td>
                                <td>{fromE8s(transaction.amount)}</td>
                                <td
                                    >{transaction.memo ??
                                        $_("cryptoAccount.unknownTransactionType")}</td>
                                <td>{client.toDatetimeString(transaction.timestamp)}</td>
                                <td>
                                    <TransactionEndpoint address={transaction.from} />
                                </td>
                                <td>
                                    <TransactionEndpoint address={transaction.to} />
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            {/if}
        </div>
        <div slot="footer">
            <div class="footer">
                <ButtonGroup>
                    <Button>cancel</Button>
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
</Overlay>

<style lang="scss">
    table {
        width: 100%;
        border-collapse: collapse;
    }
    table,
    th,
    td {
        border: 1px solid var(--bd);
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
    tr:hover {
        background-color: rgba(255, 255, 255, 0.1);
    }
    td:nth-child(2),
    th:nth-child(2) {
        text-align: right;
    }
    tr td:last-child {
        border-bottom: 1px solid var(--bd);
    }
</style>
