// The client's swaps in WalletSwap's shapes: the best quote and how many DEXes it was the best of,
// the steps and how a swap went.
import {
    dexName,
    type DexId,
    type DexQuote,
    type ResourceKey,
    type SwapFromWalletStep,
    type SwapOutcome,
    type SwapQuote,
} from "@client";
import type { SwapQuote as SwapQuoteView } from "@openchat/ui/src/features/components/WalletSwap.svelte";
import { wholeTokens } from "./wallet.adapter";

/** How many DEXes were checked for a quote: every one asked that swaps the pair at all. */
export function dexesChecked(quotes: [DexId, DexQuote][]): number {
    return quotes.filter(([, q]) => q.kind !== "unsupported").length;
}

/**
 * The best quote as Swap shows it (only the winner, and how many DEXes were checked, as the old
 * swap shows it), and the value warning to confirm in the
 * app's words (`translate` fills in the quote's values). The fees and price impact aren't known, so
 * those rows don't show, and there's no expiry: the minimum output protects a quote that's gone
 * stale.
 */
export function swapQuoteView(
    quote: SwapQuote,
    quotes: [DexId, DexQuote][],
    decimalsOut: number,
    translate: (key: string, values: Record<string, string>) => string,
): SwapQuoteView {
    const values = Object.fromEntries(Object.entries(quote.values).map(([k, v]) => [k, String(v)]));
    return {
        dex: dexName(quote.dex),
        out: wholeTokens(quote.amountOut, decimalsOut),
        checked: dexesChecked(quotes),
        warning:
            quote.valueWarning === undefined
                ? undefined
                : translate(
                      quote.valueWarning === "dropped"
                          ? "tokenSwap.warningValueDropped"
                          : "tokenSwap.warningValueUnknown",
                      values,
                  ),
    };
}

/** Swap's on-chain step for one the client reports: 0 approve, 1 swap, 2 withdraw. */
export function swapStepIndex(step: SwapFromWalletStep): number {
    switch (step.step) {
        case "approve":
            return 0;
        case "swap":
            return 1;
        case "withdraw":
            return 2;
    }
}

/**
 * What Swap hears of a swap: swapped, with the output in whole tokens; nothing sent and nothing to
 * say (the PIN prompt was dismissed), back to the quote; or failed, with why.
 */
export type SwapAnswer =
    | { kind: "swapped"; out: number }
    | { kind: "not_sent" }
    | { kind: "failed"; message: ResourceKey | undefined };

export function swapAnswer(outcome: SwapOutcome | undefined, decimalsOut: number): SwapAnswer {
    if (outcome === undefined) return { kind: "failed", message: undefined };
    switch (outcome.kind) {
        case "swapped":
            return { kind: "swapped", out: wholeTokens(outcome.amountOut, decimalsOut) };
        case "cancelled":
            return { kind: "not_sent" };
        default:
            return { kind: "failed", message: outcome.message };
    }
}
