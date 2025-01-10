<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from "svelte";
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

    export let ledgerIn: string;

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    type State = "quote" | "swap" | "finished";
    type Result = "success" | "rateChanged" | "insufficientFunds" | "error" | undefined;

    let error: string | undefined = undefined;
    let amountIn: bigint = BigInt(0);
    let busy = false;
    let valid = false;
    let state: State = "quote";
    let result: Result = undefined;
    let validAmount = false;
    let ledgerOut: string | undefined;
    let swaps = {} as Record<string, DexId[]>;
    let swapMessageValues: InterpolationValues | undefined = undefined;
    let bestQuote: [DexId, bigint] | undefined = undefined;
    let swapId: bigint | undefined;
    let userAcceptedWarning = false;
    let warnValueUnknown = false;
    let warnValueDropped = false;

    $: initialized = false;
    $: detailsIn = $cryptoLookup[ledgerIn];
    $: detailsOut = ledgerOut !== undefined ? $cryptoLookup[ledgerOut] : undefined;
    $: anySwapsAvailable = Object.keys(swaps).length > 0 && detailsOut !== undefined;
    $: swapping = state === "swap" && busy;
    $: amountInText = client.formatTokens(amountIn, detailsIn.decimals);
    $: {
        valid =
            anySwapsAvailable &&
            validAmount &&
            (state === "swap"
                ? (bestQuote !== undefined && userAcceptedWarning) ||
                  (!warnValueUnknown && !warnValueDropped)
                : true);
    }

    $: title =
        state === "quote"
            ? i18nKey("tokenSwap.swapToken", { tokenIn: detailsIn.symbol })
            : i18nKey("tokenSwap.swapTokenTo", {
                  tokenIn: detailsIn.symbol,
                  tokenOut: detailsOut!.symbol,
              });

    $: balanceIn = $cryptoBalanceStore[ledgerIn];
    $: remainingBalance =
        amountIn > BigInt(0) ? balanceIn - amountIn - detailsIn.transferFee : balanceIn;

    $: primaryButtonText = getPrimaryButtonText(state, result);
    $: pinNumberError = $pinNumberErrorMessageStore;

    onMount(() => loadSwaps(ledgerIn));

    function getPrimaryButtonText(state: State, result: Result): ResourceKey {
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
                        state = "swap";
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

    function onLedgerInSelected(ev: CustomEvent<{ ledger: string; urlFormat: string }>): void {
        loadSwaps(ev.detail.ledger);
    }

    function onSwapFinished(
        ev: CustomEvent<{
            outcome: "success" | "rateChanged" | "insufficientFunds" | "error";
            ledgerIn: string;
            ledgerOut: string;
        }>,
    ) {
        busy = false;
        state = "finished";
        result = ev.detail.outcome;

        client.refreshAccountBalance(ev.detail.ledgerIn);
        client.refreshAccountBalance(ev.detail.ledgerOut);
    }

    function onPrimaryClick() {
        if (state === "finished" && result === "insufficientFunds") {
            amountIn = BigInt(0);
            state = "quote";
        } else if (state === "quote" || result === "rateChanged") {
            quote();
        } else if (state === "swap") {
            swap();
        }
    }

    function onBalanceRefreshed() {
        error = undefined;
    }

    function onBalanceRefreshError(ev: CustomEvent<string>) {
        error = $_(ev.detail);
    }
</script>

<ModalContent>
    <span class="header" slot="header">
        <div class="main-title"><Translatable resourceKey={title} /></div>
        {#if state === "quote"}
            <BalanceWithRefresh
                ledger={ledgerIn}
                value={remainingBalance}
                label={i18nKey("cryptoAccount.shortBalanceLabel")}
                bold
                on:refreshed={onBalanceRefreshed}
                on:error={onBalanceRefreshError} />
        {/if}
    </span>
    <form class="body" slot="body">
        {#if initialized}
            {#if state === "quote"}
                <div class="swap">
                    <div class="select-from">
                        <Legend label={i18nKey("cryptoAccount.transactionHeaders.from")} />
                        <div class="inner">
                            <CryptoSelector
                                filter={(t) => t.balance > 0 && $swappableTokensStore.has(t.ledger)}
                                bind:ledger={ledgerIn}
                                on:select={onLedgerInSelected} />
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

            {#if (swapping || state === "finished") && swapId !== undefined && detailsOut !== undefined && bestQuote !== undefined}
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

            {#if state === "swap" && !swapping}
                <div>{$_("tokenSwap.bestQuote", { values: swapMessageValues })}</div>
                <Markdown text={$_("tokenSwap.youWillReceive", { values: swapMessageValues })} />

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
    <span slot="footer">
        <ButtonGroup>
            {#if !swapping}
                <Button secondary tiny={$mobileWidth} on:click={() => dispatch("close")}
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
