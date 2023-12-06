<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import TokenInput from "../TokenInput.svelte";
    import type { DexId, OpenChat } from "openchat-client";
    import { _ } from "svelte-i18n";
    import Markdown from "../Markdown.svelte";
    import { random128 } from "openchat-shared";
    import { Record } from "@dfinity/candid/lib/cjs/idl";
    import CryptoSelector from "../CryptoSelector.svelte";
    import Legend from "../../Legend.svelte";
    import SwapProgress from "./SwapProgress.svelte";

    export let ledgerIn: string;
    export let amountIn: bigint;
    export let busy = false;
    export let valid = false;
    export let swapStep: "quote" | "swap" | "swapped" = "quote";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let validAmount = false;
    let ledgerOut: string | undefined;
    let swaps = {} as Record<string, DexId[]>;
    let message: string | undefined = undefined;
    let bestQuote: [DexId, bigint] | undefined = undefined;
    let swapId: bigint | undefined;

    $: cryptoLookup = client.enhancedCryptoLookup;
    $: detailsIn = $cryptoLookup[ledgerIn];
    $: detailsOut = ledgerOut !== undefined ? $cryptoLookup[ledgerOut] : undefined;
    $: anySwapsAvailable = Object.keys(swaps).length > 0 && detailsOut !== undefined;
    $: swapping = swapStep === "swap" && busy;
    $: amountInText = client.formatTokens(amountIn, 0, detailsIn.decimals);
    $: minAmountOut =
        bestQuote !== undefined
            ? (bestQuote[1] * BigInt(detailsIn.symbol === "CHAT" ? 102 : 98)) / BigInt(100)
            : BigInt(0);

    $: {
        valid =
            anySwapsAvailable &&
            validAmount &&
            (swapStep === "swap" ? bestQuote !== undefined : true);
    }

    onMount(() => loadSwaps(ledgerIn));

    export function quote() {
        if (!valid) return;

        busy = true;
        dispatch("error", undefined);

        client
            .getTokenSwapQuotes(ledgerIn, ledgerOut!, amountIn)
            .then((response) => {
                if (response.length === 0) {
                    dispatch("error", {
                        error: "tokenSwap.noQuotes",
                        values: { tokenIn: detailsIn.symbol },
                    });
                } else {
                    bestQuote = response[0];
                    swapStep = "swap";

                    const [dexId, quote] = bestQuote!;
                    const amountOutText = client.formatTokens(quote, 0, detailsOut!.decimals);
                    const rate = (Number(amountOutText) / Number(amountInText)).toPrecision(3);
                    const dex = dexName(dexId);
                    const swapText = $_("tokenSwap.title");
                    message = $_("tokenSwap.swapInfo", {
                        values: {
                            amountIn: amountInText,
                            tokenIn: detailsIn.symbol,
                            rate,
                            amountOut: amountOutText,
                            tokenOut: detailsOut!.symbol,
                            dex,
                            swap: swapText,
                        },
                    });
                }
            })
            .catch((err) => {
                client.logError(`Error getting swap quotes for token: ${detailsIn.symbol}`, err);
                dispatch("error", {
                    error: "tokenSwap.quoteError",
                    values: { tokenIn: detailsIn.symbol },
                });
            })
            .finally(() => (busy = false));
    }

    export function swap() {
        if (!valid) return;

        busy = true;
        message = "";
        dispatch("error", undefined);
        swapId = random128();

        client.swapTokens(swapId, ledgerIn, ledgerOut!, amountIn, minAmountOut, bestQuote![0]);
    }

    function dexName(dex: DexId): string {
        switch (dex) {
            case "icpswap":
                return "ICPSwap";
        }
    }

    function loadSwaps(ledger: string) {
        client.getTokenSwaps(ledger).then((results) => {
            ledgerOut = undefined;
            swaps = results;
        });
    }

    function onLedgerInSelected(ev: CustomEvent<{ ledger: string; urlFormat: string }>): void {
        loadSwaps(ev.detail.ledger);
    }

    function onSwapFinished() {
        busy = false;
        swapStep = "swapped";

        client.refreshAccountBalance(ledgerIn);
        client.refreshAccountBalance(ledgerOut!);
    }
</script>

<div class="wrapper">
    {#if swapStep === "quote"}
        {#await client.swappableTokens() then swappableTokens}
            <div class="swap">
                <div class="select-from">
                    <Legend label={$_("cryptoAccount.transactionHeaders.from")} />
                    <div class="inner">
                        <CryptoSelector
                            filter={(t) => t.balance > 0 && swappableTokens.has(t.ledger)}
                            bind:ledger={ledgerIn}
                            on:select={onLedgerInSelected} />
                    </div>
                </div>
                <div class="amount">
                    <TokenInput
                        ledger={ledgerIn}
                        minAmount={detailsIn.transferFee * BigInt(100)}
                        maxAmount={detailsIn.balance}
                        bind:valid={validAmount}
                        bind:amount={amountIn} />
                </div>
                <div class="select-to">
                    <Legend label={$_("cryptoAccount.transactionHeaders.to")} />
                    <div class="inner">
                        <CryptoSelector
                            filter={(t) => Object.keys(swaps).includes(t.ledger)}
                            bind:ledger={ledgerOut} />
                    </div>
                </div>
            </div>
        {/await}
    {/if}

    {#if (swapping || swapStep === "swapped") && swapId !== undefined && detailsOut !== undefined && bestQuote !== undefined}
        <SwapProgress
            {swapId}
            tokenIn={detailsIn.symbol}
            tokenOut={detailsOut.symbol}
            amountIn={amountInText}
            decimalsOut={detailsOut.decimals}
            dex={dexName(bestQuote[0])}
            on:finished={onSwapFinished} />
    {/if}

    {#if message !== undefined}
        <Markdown inline={false} text={message} />
    {/if}
</div>

<style lang="scss">
    :global(.swap input.amount-val) {
        border-radius: 0 !important;
        border: var(--bw) solid var(--bd) !important;
        border-left: none !important;
        border-right: none !important;
        height: 47px;
    }

    .wrapper {
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
</style>
