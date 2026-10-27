<script lang="ts">
    import { Body, BodySmall, ColourVars, CommonButton, Container } from "component-lib";
    import {
        type AccountTransaction,
        type OpenChat,
        allUsersStore,
        cryptoLookup,
        currentUserStore,
        namedAccountsStore,
    } from "@client";
    import {
        accountTransactionUrl,
        counterpartyName,
        transactionCounterparty,
        transactionDirection,
    } from "@src/logic/wallet/accountTransactions";
    import { TransactionHistoryState } from "@src/logic/wallet/transactionHistoryState.svelte";
    import { getContext, onMount, untrack } from "svelte";
    import Chat from "svelte-material-icons/ChatOutline.svelte";
    import LoadMore from "svelte-material-icons/CloudDownloadOutline.svelte";
    import Cash from "svelte-material-icons/CurrencyUsd.svelte";
    import Flash from "svelte-material-icons/FlashOutline.svelte";
    import Gift from "svelte-material-icons/GiftOutline.svelte";
    import Unknown from "svelte-material-icons/HelpCircleOutline.svelte";
    import Robot from "svelte-material-icons/RobotConfusedOutline.svelte";
    import TrayArrowUp from "svelte-material-icons/TrayArrowUp.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import Translatable from "@shared_components/Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        ledger: string;
        urlFormat: string;
    }

    let { ledger, urlFormat }: Props = $props();

    // the token's history, a page at a time (TransactionHistoryState, shared with every tree)
    const history = untrack(
        () => new TransactionHistoryState(client, $cryptoLookup.get(ledger)?.index),
    );
    onMount(() => history.load());

    let me = $derived({
        userId: $currentUserStore.userId,
        cryptoAccount: $currentUserStore.cryptoAccount,
    });

    function accountName(transaction: AccountTransaction): string {
        return (
            counterpartyName(
                transactionCounterparty(transaction, me, $allUsersStore, $namedAccountsStore),
            ) ?? "unknown"
        );
    }

    function openDashboard(id: bigint) {
        window.open(accountTransactionUrl(urlFormat, id), "_blank");
    }

    let tokenDetails = $derived($cryptoLookup.get(ledger)!);
    let shown = $derived(history.state);
    let loading = $derived(
        shown.kind === "loading" || (shown.kind === "loaded" && shown.loadingMore),
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

<Container height={"fill"} gap={"xl"} direction={"vertical"}>
    <Container padding={["lg", "zero", "zero", "zero"]}>
        <BodySmall colour={"textOnDisabledSurface"} fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("cryptoAccount.transactions")} />
        </BodySmall>
    </Container>
    {#if shown.kind === "failed"}
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
    {:else if shown.kind === "loaded"}
        {#each shown.history.transactions as transaction (transaction.id)}
            {@const direction = transactionDirection(transaction, me)}
            {@const own = direction === "own"}
            {@const negative = direction === "out"}
            {@const colour = own ? "textSecondary" : negative ? "secondary" : "primary"}
            <Container onClick={() => openDashboard(transaction.id)} crossAxisAlignment={"end"}>
                <Container gap={"xxs"} direction={"vertical"}>
                    <BodySmall colour={"textSecondary"}>
                        {client.toDatetimeString(transaction.timestamp)}
                    </BodySmall>
                    <Container crossAxisAlignment={"center"} gap={"sm"}>
                        {@render transactionIcon(transaction)}
                        <Body width={"hug"}>
                            {#if negative}
                                <Translatable resourceKey={i18nKey("to")} />
                            {:else}
                                <Translatable resourceKey={i18nKey("from")} />
                            {/if}
                        </Body>
                        <Body {colour}>
                            {accountName(transaction)}
                        </Body>
                    </Container>
                </Container>
                <Container width={"hug"} crossAxisAlignment={"center"} gap={"xs"}>
                    {#if !own}
                        <Body fontWeight={"bold"} {colour}>
                            {#if negative}
                                -
                            {:else}
                                +
                            {/if}
                        </Body>
                    {/if}
                    <Body fontWeight={"bold"} {colour}>
                        {client.formatTokens(transaction.amount, tokenDetails.decimals)}
                    </Body>
                </Container>
            </Container>
        {/each}
    {:else if shown.kind === "loading"}
        <div class="loading">
            <FancyLoader />
        </div>
    {/if}
    {#if shown.kind !== "failed"}
        {#if history.moreAvailable}
            <Container mainAxisAlignment={"center"}>
                <CommonButton
                    size={"small_text"}
                    onClick={() => history.loadMore()}
                    disabled={loading}
                    {loading}>
                    {#snippet icon(color, size)}
                        <LoadMore {color} {size} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("cryptoAccount.loadMoreTransactions")} />
                </CommonButton>
            </Container>
        {/if}
    {/if}
</Container>

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
