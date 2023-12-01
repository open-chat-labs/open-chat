<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import TokenInput from "../TokenInput.svelte";
    import Select from "../../Select.svelte";
    import type { DexId, OpenChat } from "openchat-client";
    import { _ } from "svelte-i18n";
    import Markdown from "../Markdown.svelte";
    import { random128 } from "openchat-shared";
    import { Record } from "@dfinity/candid/lib/cjs/idl";

    export let ledgerIn: string;
    export let amountIn: bigint;
    export let busy = false;
    export let valid = false;
    export let swapStep: "quote" | "swap" | "swapped" = "quote";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let validAmount = false;
    let selectedLedgerOut: string;
    let swaps = {} as Record<string, DexId[]>;
    let message: string = $_("tokenSwap.findingAvailableTokens");
    let bestQuote: [DexId, bigint] | undefined = undefined;
    let swapId: bigint | undefined;

    $: cryptoBalanceStore = client.cryptoBalance;
    $: cryptoBalance = $cryptoBalanceStore[ledgerIn] ?? BigInt(0);
    $: cryptoLookup = client.cryptoLookup;
    $: detailsIn = $cryptoLookup[ledgerIn];
    $: detailsOutList = Object.keys(swaps)
        .map((t) => $cryptoLookup[t])
        .filter((p) => p !== undefined);
    $: selectedDetailsOut = detailsOutList.find((t) => t.ledger === selectedLedgerOut);
    $: anySwapsAvailable = Object.keys(swaps).length > 0 && selectedDetailsOut !== undefined;
    //$: swapping = swapStep === "swap" && busy;
    $: transferFees = detailsIn.transferFee;

    $: {
        valid =
            anySwapsAvailable &&
            (swapStep === "swap" ? validAmount && bestQuote !== undefined : true);
    }

    onMount(async () => {
        try {
            swaps = await client.getTokenSwaps(ledgerIn);
            message = $_("tokenSwap.quoteInfo") + "\n\n";
            for (const dex of swaps[selectedLedgerOut]) {
                message += `- ${dexName(dex)}\n`;
            }
        } catch (err) {
            client.logError(`Error getting swaps for token: ${detailsIn.symbol}`, err);
            dispatch("error", {
                error: "tokenSwap.getTokenSwapsError",
                values: { tokenIn: detailsIn.symbol },
            });
            return;
        }

        if (Object.keys(swaps).length === 0) {
            dispatch("error", {
                error: "tokenSwap.swapNotAvailable",
                values: { tokenIn: detailsIn.symbol },
            });
        }
    });

    export function quote() {
        if (!valid) return;

        busy = true;
        dispatch("error", undefined);

        client
            .getTokenSwapQuotes(ledgerIn, selectedLedgerOut, amountIn)
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
                    const quoteText = client.formatTokens(quote, 0, selectedDetailsOut!.decimals);
                    const dex = dexName(dexId);
                    message = $_("tokenSwap.swapInfo", {
                        values: {
                            amount: quoteText,
                            tokenOut: selectedDetailsOut!.symbol,
                            dex,
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
        dispatch("error", undefined);

        swapId = random128();

        const [dex, quote] = bestQuote!;
        const minAmountOut = (quote * BigInt(99)) / BigInt(100);
        const tokenInAmountText = client.formatTokens(amountIn, 0, detailsIn.decimals);
        const minAmountOutText = client.formatTokens(minAmountOut, 0, selectedDetailsOut!.decimals);
        const values = {
            tokenIn: detailsIn.symbol,
            tokenOut: selectedDetailsOut!.symbol,
            amountIn: tokenInAmountText,
            minAmountOut: minAmountOutText,
            dex: dexName(dex),
        };

        client
            .swapTokens(swapId, ledgerIn, selectedLedgerOut, amountIn, minAmountOut, dex)
            .then((response) => {
                if (response.kind === "success") {
                    swapStep = "swapped";
                    const amountOutText = client.formatTokens(
                        response.amountOut,
                        0,
                        selectedDetailsOut!.decimals,
                    );
                    message = $_("tokenSwap.swapSucceeded", {
                        values: { ...values, amountOut: amountOutText },
                    });
                } else {
                    dispatch("error", { error: "tokenSwap.swapFailed", values });
                }
            })
            .catch((err) => {
                client.logError(
                    `Failed to swap ${detailsIn.symbol} to ${
                        selectedDetailsOut!.symbol
                    } on ${dexName(dex)}`,
                    err,
                );
                dispatch("error", { error: "tokenSwap.swapFailed", values });
            })
            .finally(() => (busy = false));
    }

    function dexName(dex: DexId): string {
        switch (dex) {
            case "icpswap":
                return "ICPSwap";
        }
    }
</script>

<div class="token-input">
    <TokenInput
        ledger={ledgerIn}
        {transferFees}
        maxAmount={BigInt(Math.max(0, Number(cryptoBalance - transferFees)))}
        bind:valid={validAmount}
        bind:amount={amountIn} />
</div>

<div class="target">
    <Select bind:value={selectedLedgerOut}>
        {#each detailsOutList as target}
            <option value={target.ledger}>{target.symbol}</option>
        {/each}
    </Select>
</div>

<Markdown text={message} />

<style lang="scss">
    .token-input {
        margin-bottom: $sp3;
    }
    .target {
        margin-bottom: $sp3;
    }
</style>
