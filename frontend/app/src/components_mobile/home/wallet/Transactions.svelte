<script lang="ts">
    import { Body, BodySmall, ColourVars, CommonButton, Container } from "component-lib";
    import {
        type AccountTransaction,
        type AccountTransactions,
        type OpenChat,
        allUsersStore,
        cryptoLookup,
        currentUserIdStore,
        currentUserStore,
        namedAccountsStore,
        toRecord,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import Chat from "svelte-material-icons/ChatOutline.svelte";
    import Cash from "svelte-material-icons/CurrencyUsd.svelte";
    import Flash from "svelte-material-icons/FlashOutline.svelte";
    import Gift from "svelte-material-icons/GiftOutline.svelte";
    import Unknown from "svelte-material-icons/HelpCircleOutline.svelte";
    import Robot from "svelte-material-icons/RobotConfusedOutline.svelte";
    import TrayArrowUp from "svelte-material-icons/TrayArrowUp.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import type { RemoteData as RD } from "../../../utils/remoteData";
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        ledger: string;
        urlFormat: string;
    }

    let { ledger, urlFormat }: Props = $props();

    type LoadingMore<T> = { kind: "loading_more"; data: T };
    type RemoteData = RD<AccountTransactions, string> | LoadingMore<AccountTransactions>;

    let transactionData = $state<RemoteData>({ kind: "loading" });
    let accountLookup = $derived(toRecord($namedAccountsStore, (a) => a.account));

    function moreTransactionsAvailable(trans: RemoteData): boolean {
        if (trans.kind !== "success") return false;
        if (trans.data.oldestTransactionId === undefined) return false;
        if (trans.data.transactions.length === 0) return false;
        const lastLoaded = trans.data.transactions[trans.data.transactions.length - 1];
        return lastLoaded.id > trans.data.oldestTransactionId;
    }

    function fromMe({ from }: AccountTransaction): boolean {
        return from === $currentUserIdStore || from === $currentUserStore.cryptoAccount;
    }

    function accountName(transaction: AccountTransaction) {
        const out = fromMe(transaction);
        const address = out ? transaction.to : transaction.from;
        return addressName(address);
    }

    function addressName(address?: string) {
        if (address === undefined) return "unknown";
        const user = $allUsersStore.get(address);
        if (user !== undefined) return `@${user.username}`;
        return accountLookup[address]?.name ?? collapseAccount(address);
    }

    function collapseAccount(account: string) {
        if (account.length > 23) {
            return account.slice(0, 10) + "..." + account.slice(account.length - 10);
        }
        return account;
    }

    onMount(async () => {
        loadTransactions();
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

    function loadTransactions() {
        const ledgerIndex = $cryptoLookup.get(ledger)?.index;
        if (ledgerIndex !== undefined) {
            let start = undefined;
            if (transactionData.kind === "success") {
                start =
                    transactionData.data.transactions[transactionData.data.transactions.length - 1]
                        .id - 1n;
                transactionData = { kind: "loading_more", data: transactionData.data };
            } else {
                transactionData = { kind: "loading" };
            }
            client
                .getAccountTransactions(ledgerIndex, start)
                .then((result) => {
                    if (result.kind === "failure") {
                        transactionData = { kind: "idle" };
                        console.warn("Error loading transactions: ", result);
                        // toastStore.showFailureToast(i18nKey("cryptoAccount.transactionError"));
                    } else {
                        // Filter out approvals
                        const transactions = result.transactions.filter(
                            (t) => t.kind !== "approve",
                        );
                        if (transactionData.kind === "loading") {
                            transactionData = {
                                kind: "success",
                                data: { ...result, transactions },
                            };
                        } else if (transactionData.kind === "loading_more") {
                            transactionData = {
                                kind: "success",
                                data: {
                                    oldestTransactionId: result.oldestTransactionId,
                                    transactions: [
                                        ...transactionData.data.transactions,
                                        ...transactions,
                                    ],
                                },
                            };
                        }
                    }
                })
                .catch((err) => {
                    console.warn("Error loading transactions: ", err);
                    transactionData = { kind: "idle" };
                    // toastStore.showFailureToast(i18nKey("cryptoAccount.transactionError"));
                });
        } else {
            //toastStore.showFailureToast(i18nKey("cryptoAccount.transactionError"));
            transactionData = { kind: "idle" };
            console.warn("Could not find ledger index for ledger", ledger);
        }
    }
    let tokenDetails = $derived($cryptoLookup.get(ledger)!);
    let moreAvailable = $derived(moreTransactionsAvailable(transactionData));
    let loading = $derived(
        transactionData.kind === "loading" || transactionData.kind === "loading_more",
    );
</script>

{#snippet transactionIcon({ memo }: AccountTransaction)}
    {#if memo === "OC_MSG"}
        <Chat color={ColourVars.textPrimary} />
    {:else if memo === "OC_SEND"}
        <TrayArrowUp color={ColourVars.textPrimary} />
    {:else if memo === "OC_TIP"}
        <Cash color={ColourVars.textPrimary} />
    {:else if memo === "OC_PRZ"}
        <Gift color={ColourVars.textPrimary} />
    {:else if memo === "OC_PRZCL"}
        <Gift color={ColourVars.textPrimary} />
    {:else if memo === "OC_PRZRF"}
        <Gift color={ColourVars.textPrimary} />
    {:else if memo === "OC_INS"}
        <Flash color={ColourVars.textPrimary} />
    {:else}
        <Unknown color={ColourVars.textPrimary} />
    {/if}
{/snippet}

<Container height={{ kind: "fill" }} gap={"xl"} direction={"vertical"}>
    <Container padding={["lg", "zero", "zero", "zero"]}>
        <BodySmall colour={"textTertiary"} fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("cryptoAccount.transactions")} />
        </BodySmall>
    </Container>
    {#if transactionData.kind === "idle"}
        <Container
            gap={"lg"}
            padding={["zero", "xxl"]}
            direction={"vertical"}
            mainAxisAlignment={"center"}
            crossAxisAlignment={"center"}>
            <Robot size={"6rem"} color={ColourVars.primary} />
            <Body align={"center"} fontWeight={"bold"} colour={"primary"}>
                <Translatable resourceKey={i18nKey("No transactions found")} />
            </Body>
            <BodySmall align={"center"} colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey(
                        `You don’t have any transactions for the ${tokenDetails.symbol} token. As soon as you receive or swap the token, your transactions will appear here.`,
                    )} />
            </BodySmall>
        </Container>
    {:else if transactionData.kind === "success" || transactionData.kind === "loading_more"}
        {#each transactionData.data.transactions as transaction (transaction.id)}
            {@const negative = fromMe(transaction)}
            <Container onClick={() => openDashboard(transaction.id)} crossAxisAlignment={"end"}>
                <Container gap={"xxs"} direction={"vertical"}>
                    <BodySmall colour={"textSecondary"}>
                        {client.toDatetimeString(transaction.timestamp)}
                    </BodySmall>
                    <Container crossAxisAlignment={"center"} gap={"sm"}>
                        {@render transactionIcon(transaction)}
                        <Body width={{ kind: "hug" }}>
                            {#if negative}
                                <Translatable resourceKey={i18nKey("to")} />
                            {:else}
                                <Translatable resourceKey={i18nKey("from")} />
                            {/if}
                        </Body>
                        <Body colour={negative ? "secondary" : "primary"}>
                            {accountName(transaction)}
                        </Body>
                    </Container>
                </Container>
                <Container width={{ kind: "hug" }} crossAxisAlignment={"center"} gap={"xs"}>
                    <Body fontWeight={"bold"} colour={negative ? "secondary" : "primary"}>
                        {#if negative}
                            -
                        {:else}
                            +
                        {/if}
                    </Body>
                    <Body fontWeight={"bold"} colour={negative ? "secondary" : "primary"}>
                        {client.formatTokens(transaction.amount, tokenDetails.decimals)}
                    </Body>
                </Container>
            </Container>
        {/each}
    {:else if transactionData.kind === "loading"}
        <div class="loading">
            <FancyLoader />
        </div>
    {/if}
</Container>

{#if transactionData.kind !== "idle"}
    <Container mainAxisAlignment={"end"}>
        <CommonButton
            mode={"active"}
            onClick={loadTransactions}
            disabled={!moreAvailable && !loading}
            {loading}>
            <Translatable resourceKey={i18nKey("cryptoAccount.loadMoreTransactions")} />
        </CommonButton>
    </Container>
{/if}

<style lang="scss">
    .loading {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 3rem;
        height: 10rem;
        margin: 0 auto;
    }
</style>
