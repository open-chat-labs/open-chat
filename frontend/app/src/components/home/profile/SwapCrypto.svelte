<script lang="ts">
    import { getContext, onMount } from "svelte";
    import TokenInput from "../TokenInput.svelte";
    import type { DexId, InterpolationValues, OpenChat, ResourceKey } from "openchat-client";
    import {
        enhancedCryptoLookup as cryptoLookup,
        exchangeRatesLookupStore as exchangeRatesLookup,
        cryptoBalance as cryptoBalanceStore,
        swappableTokensStore,
    } from "openchat-client";
    import { _ } from "svelte-i18n";
    import Markdown from "../Markdown.svelte";
    import { random128 } from "openchat-shared";
    import { Record } from "@dfinity/candid/lib/cjs/idl";
    import CryptoSelector from "../CryptoSelector.svelte";
    import Legend from "../../Legend.svelte";
    import SwapProgress from "./SwapProgress.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Button from "../../Button.svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import { pinNumberErrorMessageStore } from "../../../stores/pinNumber";
    import { calculateDollarAmount } from "../../../utils/exchange";
    import AlertBox from "../../AlertBox.svelte";
    import Checkbox from "../../Checkbox.svelte";

    interface Props {
        ledgerIn: string;
        onClose: () => void;
    }

    let { ledgerIn = $bindable(), onClose }: Props = $props();

    const client = getContext<OpenChat>("client");

    type SwapState = "quote" | "swap" | "finished";
    type Result = "success" | "rateChanged" | "insufficientFunds" | "error" | undefined;

    let error: string | undefined = $state(undefined);
    let amountIn: bigint = $state(BigInt(0));
    let busy = $state(false);
    let valid = $state(false);
    let swapState = $state<SwapState>("quote");
    let result: Result = $state(undefined);
    let validAmount = $state(false);
    let ledgerOut: string | undefined = $state();
    let swaps = $state({} as Record<string, DexId[]>);
    let swapMessageValues: InterpolationValues | undefined = $state(undefined);
    let bestQuote: [DexId, bigint] | undefined = $state(undefined);
    let swapId: bigint | undefined = $state();
    let userAcceptedWarning = $state(false);
    let warnValueUnknown = $state(false);
    let warnValueDropped = $state(false);

    onMount(() => loadSwaps(ledgerIn));

    function getPrimaryButtonText(state: SwapState, result: Result): ResourceKey {
        let label;

        if (state === "finished") {
            label = result === "insufficientFunds" ? "back" : "requote";
        } else {
            label = state;
        }

        return i18nKey(`tokenSwap.${label}`);
    }

    function quote() {
        if (!valid) return;

        busy = true;
        error = undefined;
        result = undefined;
        swapId = undefined;

        client
            .getTokenSwapQuotes(ledgerIn, ledgerOut!, amountIn - BigInt(2) * detailsIn.transferFee)
            .then((response) => {
                if (response.length === 0) {
                    error = $_("tokenSwap.noQuotes", { values: { tokenIn: detailsIn.symbol } });
                } else {
                    bestQuote = response[0];

                    const [dexId, quote] = bestQuote!;

                    const amountOutText = client.formatTokens(quote, detailsOut!.decimals);
                    const rate = (Number(amountOutText) / Number(amountInText)).toPrecision(3);
                    const dex = dexName(dexId);
                    const minAmountOut = BigInt(10) * detailsOut!.transferFee;
                    const minAmountOutText = client.formatTokens(
                        minAmountOut,
                        detailsOut!.decimals,
                    );

                    const usdInText = calculateDollarAmount(
                        amountIn,
                        $exchangeRatesLookup[detailsIn.symbol.toLowerCase()]?.toUSD,
                        detailsIn.decimals,
                    );
                    const usdOutText = calculateDollarAmount(
                        bestQuote[1],
                        $exchangeRatesLookup[detailsOut!.symbol.toLowerCase()]?.toUSD,
                        detailsOut!.decimals,
                    );

                    warnValueUnknown = usdInText === "???" || usdOutText === "???";
                    warnValueDropped =
                        !warnValueUnknown && Number(usdOutText) < 0.9 * Number(usdInText);

                    swapMessageValues = {
                        amountIn: amountInText,
                        tokenIn: detailsIn.symbol,
                        rate,
                        amountOut: amountOutText,
                        tokenOut: detailsOut!.symbol,
                        dex,
                        minAmountOut: minAmountOutText,
                        usdOut: usdOutText,
                        usdIn: usdInText,
                    };

                    if (quote > minAmountOut) {
                        swapState = "swap";
                    } else {
                        error = $_("tokenSwap.quoteTooLow", { values: swapMessageValues });
                    }
                }
            })
            .catch((err) => {
                client.logError(`Error getting swap quotes for token: ${detailsIn.symbol}`, err);
                error = $_("tokenSwap.quoteError", { values: { tokenIn: detailsIn.symbol } });
            })
            .finally(() => (busy = false));
    }

    function swap() {
        if (!valid || bestQuote === undefined) return;

        busy = true;
        error = undefined;
        result = undefined;

        const ledgerInLocal = ledgerIn;
        const ledgerOutLocal = ledgerOut!;
        const bestQuoteLocal = bestQuote;

        let minAmountOut = (bestQuoteLocal[1] * BigInt(98)) / BigInt(100);

        client
            .refreshAccountBalance(ledgerIn)
            .then((balance) => {
                if (balance < amountIn) {
                    error = $_("tokenSwap.progress.insufficientFunds");
                    result = "insufficientFunds";
                    return false;
                } else {
                    return true;
                }
            })
            .then((balanceCheckSuccess) => {
                if (balanceCheckSuccess) {
                    swapId = random128();
                    return client.swapTokens(
                        swapId,
                        ledgerInLocal,
                        ledgerOutLocal,
                        amountIn,
                        minAmountOut,
                        bestQuoteLocal[0],
                    );
                }
            })
            .catch(() => {
                swapId = undefined;
                busy = false;
            });
    }

    function dexName(dex: DexId): string {
        switch (dex) {
            case "icpswap":
                return "ICPSwap";

            case "sonic":
                return "Sonic";

            case "kongswap":
                return "KongSwap";
        }
    }

    function loadSwaps(ledger: string) {
        client.getTokenSwaps(ledger).then((results) => {
            ledgerOut = undefined;
            swaps = results;
            client.refreshSwappableTokens();
            initialized = true;
        });
    }

    function onLedgerInSelected(ledger: string, _: string): void {
        loadSwaps(ledger);
    }

    function onSwapFinished(
        ev: CustomEvent<{
            outcome: "success" | "rateChanged" | "insufficientFunds" | "error";
            ledgerIn: string;
            ledgerOut: string;
        }>,
    ) {
        busy = false;
        swapState = "finished";
        result = ev.detail.outcome;

        client.refreshAccountBalance(ev.detail.ledgerIn);
        client.refreshAccountBalance(ev.detail.ledgerOut);
    }

    function onPrimaryClick() {
        if (swapState === "finished" && result === "insufficientFunds") {
            amountIn = BigInt(0);
            swapState = "quote";
        } else if (swapState === "quote" || result === "rateChanged") {
            quote();
        } else if (swapState === "swap") {
            swap();
        }
    }

    function onBalanceRefreshed() {
        error = undefined;
    }

    function onBalanceRefreshError(ev: CustomEvent<string>) {
        error = $_(ev.detail);
    }
    let initialized = $state(false);

    let detailsIn = $derived($cryptoLookup[ledgerIn]);
    let detailsOut = $derived(ledgerOut !== undefined ? $cryptoLookup[ledgerOut] : undefined);
    let anySwapsAvailable = $derived(Object.keys(swaps).length > 0 && detailsOut !== undefined);
    let swapping = $derived(swapState === "swap" && busy);
    let amountInText = $derived(client.formatTokens(amountIn, detailsIn.decimals));
    $effect(() => {
        valid =
            anySwapsAvailable &&
            validAmount &&
            (swapState === "swap"
                ? (bestQuote !== undefined && userAcceptedWarning) ||
                  (!warnValueUnknown && !warnValueDropped)
                : true);
    });
    let title = $derived(
        swapState === "quote"
            ? i18nKey("tokenSwap.swapToken", { tokenIn: detailsIn.symbol })
            : i18nKey("tokenSwap.swapTokenTo", {
                  tokenIn: detailsIn.symbol,
                  tokenOut: detailsOut!.symbol,
              }),
    );
    let balanceIn = $derived($cryptoBalanceStore[ledgerIn]);
    let remainingBalance = $derived(
        amountIn > BigInt(0) ? balanceIn - amountIn - detailsIn.transferFee : balanceIn,
    );
    let primaryButtonText = $derived(getPrimaryButtonText(swapState, result));
    let pinNumberError = $derived($pinNumberErrorMessageStore);
</script>

<ModalContent>
    {#snippet header()}
        <span class="header">
            <div class="main-title"><Translatable resourceKey={title} /></div>
            {#if swapState === "quote"}
                <BalanceWithRefresh
                    ledger={ledgerIn}
                    value={remainingBalance}
                    label={i18nKey("cryptoAccount.shortBalanceLabel")}
                    bold
                    on:refreshed={onBalanceRefreshed}
                    on:error={onBalanceRefreshError} />
            {/if}
        </span>
    {/snippet}
    {#snippet body()}
        <form class="body">
            {#if initialized}
                {#if swapState === "quote"}
                    <div class="swap">
                        <div class="select-from">
                            <Legend label={i18nKey("cryptoAccount.transactionHeaders.from")} />
                            <div class="inner">
                                <CryptoSelector
                                    filter={(t) =>
                                        t.balance > 0 && $swappableTokensStore.has(t.ledger)}
                                    bind:ledger={ledgerIn}
                                    onSelect={onLedgerInSelected} />
                            </div>
                        </div>
                        <div class="amount">
                            <TokenInput
                                ledger={ledgerIn}
                                minAmount={detailsIn.transferFee * BigInt(10)}
                                maxAmount={detailsIn.balance}
                                bind:valid={validAmount}
                                bind:amount={amountIn} />
                        </div>
                        <div class="select-to">
                            <Legend label={i18nKey("cryptoAccount.transactionHeaders.to")} />
                            <div class="inner">
                                <CryptoSelector
                                    filter={(t) => Object.keys(swaps).includes(t.ledger)}
                                    bind:ledger={ledgerOut} />
                            </div>
                        </div>
                    </div>
                {/if}

                {#if (swapping || swapState === "finished") && swapId !== undefined && detailsOut !== undefined && bestQuote !== undefined}
                    <div>
                        <SwapProgress
                            {swapId}
                            tokenIn={detailsIn.symbol}
                            tokenOut={detailsOut.symbol}
                            ledgerIn={detailsIn.ledger}
                            ledgerOut={detailsOut.ledger}
                            amountIn={amountInText}
                            decimalsOut={detailsOut.decimals}
                            dex={dexName(bestQuote[0])}
                            on:finished={onSwapFinished} />
                    </div>
                {/if}

                {#if swapState === "swap" && !swapping}
                    <div>{$_("tokenSwap.bestQuote", { values: swapMessageValues })}</div>
                    <Markdown
                        text={$_("tokenSwap.youWillReceive", { values: swapMessageValues })} />

                    {#if warnValueDropped || warnValueUnknown}
                        <AlertBox>
                            <div class="warning">
                                {#if warnValueDropped}
                                    <Translatable
                                        resourceKey={i18nKey(
                                            "tokenSwap.warningValueDropped",
                                            swapMessageValues,
                                        )} />
                                {:else}
                                    <Translatable
                                        resourceKey={i18nKey(
                                            "tokenSwap.warningValueUnknown",
                                            swapMessageValues,
                                        )} />
                                {/if}
                            </div>
                            <Checkbox
                                id="confirm-understanding"
                                small
                                label={i18nKey("tokenSwap.confirmUnderstanding")}
                                bind:checked={userAcceptedWarning} />
                        </AlertBox>
                    {/if}

                    <div>{$_("tokenSwap.proceedWithSwap", { values: swapMessageValues })}</div>
                {/if}

                {#if error !== undefined || pinNumberError !== undefined}
                    <ErrorMessage>
                        {#if pinNumberError !== undefined}
                            <Translatable resourceKey={pinNumberError} />
                        {:else}
                            {error}
                        {/if}
                    </ErrorMessage>
                {/if}
            {/if}
        </form>
    {/snippet}
    {#snippet footer()}
        <span>
            <ButtonGroup>
                {#if !swapping}
                    <Button secondary tiny={$mobileWidth} on:click={onClose}
                        ><Translatable resourceKey={i18nKey("close")} /></Button>
                {/if}
                {#if result !== "success" && result !== "error"}
                    <Button
                        disabled={busy || !valid}
                        loading={busy}
                        tiny={$mobileWidth}
                        on:click={onPrimaryClick}
                        ><Translatable resourceKey={primaryButtonText} /></Button>
                {/if}
            </ButtonGroup>
        </span>
    {/snippet}
</ModalContent>

<style lang="scss">
    :global(.swap input.amount-val) {
        border-radius: 0 !important;
        border: var(--bw) solid var(--bd) !important;
        border-left: none !important;
        border-right: none !important;
        height: 47px;
    }

    .header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: $sp2;

        .main-title {
            flex: auto;
        }
    }

    .body {
        display: flex;
        flex-direction: column;
        gap: $sp4;
    }

    .swap {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .inner {
            @include font(book, normal, fs-100);
            padding: 0 $sp4;
            border: var(--bw) solid var(--bd);
            background-color: var(--modal-bg);
            display: flex;
            height: 47px;
            align-items: center;
        }

        .select-from .inner {
            border-radius: var(--rd) 0 0 var(--rd);
        }

        .select-to .inner {
            border-radius: 0 var(--rd) var(--rd) 0;
        }

        .amount {
            flex-grow: 1;
        }
    }

    .warning {
        margin-bottom: $sp4;
    }
</style>
